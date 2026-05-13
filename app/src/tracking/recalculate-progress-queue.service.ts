import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Queue, Worker, Job } from 'bullmq';
import Redis, { RedisOptions } from 'ioredis';
import { TrackingService } from './tracking.service';
import { RecalculateProgressJobStore } from './recalculate-progress-job.store';

export const RECALCULATE_PROGRESS_QUEUE = 'recalculate-progress';

/** BullMQ must renew the lock while the processor runs; recalc can take a long time */
const RECALC_LOCK_MS = 3_600_000; // 1 hour

/** Waiting/delayed jobs older than this are treated as abandoned (no worker / stuck queue) */
const STALE_WAITING_MS = 45 * 60 * 1000; // 45 minutes

/** Active jobs running longer than lock + this grace are treated as zombie / stuck locks */
const STALE_ACTIVE_GRACE_MS = 30 * 60 * 1000; // 30 minutes past lock duration

export interface RecalculateProgressJobPayload {
  courseId: string;
  tenantId: string;
  organisationId: string;
  /** DB primary key in recalculate_progress_jobs */
  recordId: string;
}

export interface EnqueueRecalculateResult {
  jobId: string;
  /** Database row id (recalculate_progress_jobs.job_id) for listing/history */
  recordId?: string;
  message: string;
  deduplicated?: boolean;
  removedStaleJobs?: number;
}

@Injectable()
export class RecalculateProgressQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecalculateProgressQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisOptions: RedisOptions | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly trackingService: TrackingService,
    private readonly jobStore: RecalculateProgressJobStore,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.configService.get('REDIS_HOST'));
  }

  private getRedisOptions(): RedisOptions | null {
    const host = this.configService.get<string>('REDIS_HOST');
    if (!host) {
      return null;
    }
    return {
      host,
      port: Number(this.configService.get('REDIS_PORT') || 6379),
      db: Number(this.configService.get('REDIS_DB') || 0),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      maxRetriesPerRequest: null,
    };
  }

  onModuleInit(): void {
    this.redisOptions = this.getRedisOptions();
    if (!this.redisOptions) {
      this.logger.log(
        'Recalculate-progress queue disabled (REDIS_HOST not set). Use synchronous recalculate or configure Redis.',
      );
      return;
    }

    this.queue = new Queue(RECALCULATE_PROGRESS_QUEUE, {
      connection: new Redis(this.redisOptions),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 86_400, count: 500 },
        removeOnFail: { age: 604_800, count: 200 },
      },
    });

    this.queue.on('error', (err: Error) => {
      this.logger.error(`[queue] Queue Redis error: ${err.message}`, err.stack);
    });

    this.worker = new Worker(
      RECALCULATE_PROGRESS_QUEUE,
      async (job: Job<RecalculateProgressJobPayload>) => {
        const { courseId, tenantId, organisationId } = job.data;
        this.logger.log(`[queue] Starting recalculate-progress job ${job.id} courseId=${courseId}`);
        const result = await this.trackingService.recalculateProgress(courseId, tenantId, organisationId);
        this.logger.log(`[queue] Finished recalculate-progress job ${job.id} courseId=${courseId}`);
        return result;
      },
      {
        connection: new Redis(this.redisOptions),
        concurrency: 1,
        lockDuration: RECALC_LOCK_MS,
        stalledInterval: 120_000,
        maxStalledCount: 5,
      },
    );

    this.worker.on('active', (job: Job<RecalculateProgressJobPayload>) => {
      const recordId = job.data?.recordId;
      if (recordId) {
        void this.jobStore.markRunning(recordId).catch((err) =>
          this.logger.error(`[queue] markRunning failed for ${recordId}`, err),
        );
      }
    });

    this.worker.on('completed', (job: Job<RecalculateProgressJobPayload>, result: unknown) => {
      const recordId = job.data?.recordId;
      if (!recordId) {
        return;
      }
      const payload =
        result && typeof result === 'object'
          ? (result as {
              success?: boolean;
              message?: string;
              courseTrackUpdated?: number;
              moduleTrackUpdated?: number;
            })
          : {};
      void this.jobStore.markCompleted(recordId, payload).catch((err) =>
        this.logger.error(`[queue] markCompleted failed for ${recordId}`, err),
      );
    });

    this.worker.on('failed', (job: Job<RecalculateProgressJobPayload> | undefined, err: Error) => {
      this.logger.error(`[queue] Job ${job?.id} failed: ${err?.message}`, err?.stack);
      const recordId = job?.data?.recordId;
      if (!recordId) {
        return;
      }
      void this.jobStore
        .markFailed(recordId, err?.message ?? 'Job failed')
        .catch((e) => this.logger.error(`[queue] markFailed failed for ${recordId}`, e));
    });

    this.worker.on('error', (err: Error) => {
      this.logger.error(`[queue] Worker Redis error: ${err.message}`, err.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private sameRecalcPayload(
    a: Pick<RecalculateProgressJobPayload, 'courseId' | 'tenantId' | 'organisationId'>,
    b: Pick<RecalculateProgressJobPayload, 'courseId' | 'tenantId' | 'organisationId'>,
  ): boolean {
    return (
      a.courseId === b.courseId &&
      a.tenantId === b.tenantId &&
      a.organisationId === b.organisationId
    );
  }

  /** New id on every enqueue (BullMQ disallows `:` in custom ids). */
  private newJobId(): string {
    return `rp_${randomUUID().replace(/-/g, '')}`;
  }

  private async isStaleRecalcJob(job: Job): Promise<boolean> {
    const state = await job.getState();
    const now = Date.now();
    const ts = job.timestamp ?? 0;

    if (
      state === 'waiting' ||
      state === 'delayed' ||
      state === 'prioritized' ||
      state === 'waiting-children'
    ) {
      return ts > 0 && now - ts > STALE_WAITING_MS;
    }

    if (state === 'active') {
      const started = job.processedOn ?? ts;
      const maxMs = RECALC_LOCK_MS + STALE_ACTIVE_GRACE_MS;
      return started > 0 && now - started > maxMs;
    }

    return false;
  }

  private async removeJobWithLog(job: Job, reason: string): Promise<boolean> {
    const id = String(job.id);
    await this.jobStore.markCancelledByBullJobId(id, reason);
    try {
      const state = await job.getState();
      await job.remove();
      this.logger.warn(`[queue] Removed job ${id} (${state}): ${reason}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `[queue] Could not remove job ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Drop all queued/running recalculate jobs for the same course (used with force=true).
   */
  private async removeAllInFlightForCourse(
    payload: Pick<RecalculateProgressJobPayload, 'courseId' | 'tenantId' | 'organisationId'>,
  ): Promise<number> {
    if (!this.queue) {
      return 0;
    }
    const jobs = await this.queue.getJobs(
      ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'],
      0,
      2000,
    );
    let removed = 0;
    for (const job of jobs) {
      const data = job.data as RecalculateProgressJobPayload | undefined;
      if (data && this.sameRecalcPayload(data, payload)) {
        if (
          await this.removeJobWithLog(job, 'force=true cleared in-flight recalculate for this course')
        ) {
          removed += 1;
        }
      }
    }
    return removed;
  }

  /**
   * If the same course already has a non-stale waiting/active job, return it.
   * Stale jobs are removed so a new run can be enqueued.
   */
  private async findOrClearInFlightRecalcJob(
    payload: Pick<RecalculateProgressJobPayload, 'courseId' | 'tenantId' | 'organisationId'>,
  ): Promise<{ blocking: Job | null; removedStale: number }> {
    if (!this.queue) {
      return { blocking: null, removedStale: 0 };
    }
    const jobs = await this.queue.getJobs(
      ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'],
      0,
      2000,
    );
    let removedStale = 0;
    for (const job of jobs) {
      const data = job.data as RecalculateProgressJobPayload | undefined;
      if (!data || !this.sameRecalcPayload(data, payload)) {
        continue;
      }
      if (await this.isStaleRecalcJob(job)) {
        if (
          await this.removeJobWithLog(
            job,
            `stale threshold (waiting>${STALE_WAITING_MS}ms or active>${RECALC_LOCK_MS + STALE_ACTIVE_GRACE_MS}ms)`,
          )
        ) {
          removedStale += 1;
        }
        continue;
      }
      return { blocking: job, removedStale };
    }
    return { blocking: null, removedStale };
  }

  async enqueue(
    jobData: Pick<RecalculateProgressJobPayload, 'courseId' | 'tenantId' | 'organisationId'>,
    opts?: { force?: boolean },
  ): Promise<EnqueueRecalculateResult> {
    if (!this.queue) {
      throw new ServiceUnavailableException(
        'Background recalculate is not available. Set REDIS_HOST or call without async mode.',
      );
    }

    let removedStaleJobs = 0;

    if (opts?.force) {
      removedStaleJobs += await this.removeAllInFlightForCourse(jobData);
    } else {
      const { blocking, removedStale } = await this.findOrClearInFlightRecalcJob(jobData);
      removedStaleJobs += removedStale;
      if (blocking) {
        const existing = await this.jobStore.findByBullJobId(String(blocking.id));
        return {
          jobId: String(blocking.id),
          recordId: existing?.jobId,
          message: 'A recalculate job for this course is already queued or running.',
          deduplicated: true,
          removedStaleJobs: removedStaleJobs > 0 ? removedStaleJobs : undefined,
        };
      }
    }

    const dbRow = await this.jobStore.createQueued(
      jobData.courseId,
      jobData.tenantId,
      jobData.organisationId,
    );

    const bullPayload: RecalculateProgressJobPayload = {
      ...jobData,
      recordId: dbRow.jobId,
    };

    try {
      const redisJobId = this.newJobId();
      const job = await this.queue.add('run', bullPayload, { jobId: redisJobId });
      await this.jobStore.setBullJobId(dbRow.jobId, String(job.id));

      return {
        jobId: String(job.id),
        recordId: dbRow.jobId,
        message: opts?.force
          ? 'Recalculate job queued (previous in-flight jobs for this course were removed).'
          : 'Recalculate job queued. Poll job status until completed.',
        deduplicated: false,
        removedStaleJobs: removedStaleJobs > 0 ? removedStaleJobs : undefined,
      };
    } catch (err) {
      await this.jobStore.markFailed(
        dbRow.jobId,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  async getJobStatus(jobId: string, tenantId: string, organisationId: string) {
    if (!this.queue) {
      throw new ServiceUnavailableException('Background queue is not configured.');
    }

    const id = decodeURIComponent(jobId).trim();
    if (!id) {
      return null;
    }

    const job = await this.queue.getJob(id);
    if (!job) {
      return null;
    }

    const data = job.data as RecalculateProgressJobPayload | undefined;
    if (!data?.tenantId || !data?.organisationId) {
      this.logger.warn(`[queue] Job ${id} has no usable payload`);
      return null;
    }

    if (data.tenantId !== tenantId || data.organisationId !== organisationId) {
      return null;
    }

    const state = await job.getState();
    const raw = job.returnvalue as
      | {
          success?: boolean;
          message?: string;
          courseTrackUpdated?: number;
          moduleTrackUpdated?: number;
        }
      | undefined;

    let dbRecord: Awaited<ReturnType<RecalculateProgressJobStore['findByRecordId']>> = null;
    if (data.recordId) {
      dbRecord = await this.jobStore.findByRecordId(data.recordId, tenantId, organisationId);
    }

    return {
      jobId: job.id,
      recordId: data.recordId,
      state,
      progress: typeof job.progress === 'number' ? job.progress : undefined,
      courseId: data.courseId,
      result: state === 'completed' ? raw : undefined,
      failedReason: state === 'failed' ? job.failedReason : undefined,
      dbStatus: dbRecord?.status,
      dbFinishedAt: dbRecord?.finishedAt ?? undefined,
    };
  }
}
