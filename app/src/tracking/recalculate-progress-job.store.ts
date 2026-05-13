import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  RecalculateProgressJob,
  RecalculateProgressJobStatus,
} from './entities/recalculate-progress-job.entity';

export interface ListRecalculateProgressJobsParams {
  tenantId: string;
  organisationId: string;
  courseId?: string;
  status?: RecalculateProgressJobStatus;
  limit: number;
  offset: number;
}

@Injectable()
export class RecalculateProgressJobStore {
  constructor(
    @InjectRepository(RecalculateProgressJob)
    private readonly repo: Repository<RecalculateProgressJob>,
  ) {}

  async createQueued(courseId: string, tenantId: string, organisationId: string): Promise<RecalculateProgressJob> {
    const now = new Date();
    const row = this.repo.create({
      courseId,
      tenantId,
      organisationId,
      status: RecalculateProgressJobStatus.QUEUED,
      queuedAt: now,
      bullJobId: null,
    });
    return this.repo.save(row);
  }

  async setBullJobId(recordId: string, bullJobId: string): Promise<void> {
    await this.repo.update(
      { jobId: recordId },
      { bullJobId },
    );
  }

  async markRunning(recordId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { jobId: recordId } });
    if (!row) {
      return;
    }
    if (
      row.status === RecalculateProgressJobStatus.COMPLETED ||
      row.status === RecalculateProgressJobStatus.FAILED ||
      row.status === RecalculateProgressJobStatus.CANCELLED
    ) {
      return;
    }
    row.status = RecalculateProgressJobStatus.RUNNING;
    row.startedAt = row.startedAt ?? new Date();
    await this.repo.save(row);
  }

  async markCompleted(
    recordId: string,
    result: {
      success?: boolean;
      message?: string;
      courseTrackUpdated?: number;
      moduleTrackUpdated?: number;
    },
  ): Promise<void> {
    const finishedAt = new Date();
    await this.repo.update(
      { jobId: recordId },
      {
        status: RecalculateProgressJobStatus.COMPLETED,
        finishedAt,
        resultJson: result,
        errorMessage: null,
      },
    );
  }

  async markFailed(recordId: string, errorMessage: string): Promise<void> {
    const finishedAt = new Date();
    await this.repo.update(
      { jobId: recordId },
      {
        status: RecalculateProgressJobStatus.FAILED,
        finishedAt,
        errorMessage: errorMessage?.slice(0, 20000) ?? 'Unknown error',
      },
    );
  }

  async markCancelledByBullJobId(bullJobId: string, reason: string): Promise<void> {
    const row = await this.repo.findOne({ where: { bullJobId } });
    if (!row) {
      return;
    }
    if (
      row.status === RecalculateProgressJobStatus.COMPLETED ||
      row.status === RecalculateProgressJobStatus.FAILED
    ) {
      return;
    }
    await this.repo.update(
      { jobId: row.jobId },
      {
        status: RecalculateProgressJobStatus.CANCELLED,
        finishedAt: new Date(),
        errorMessage: reason.slice(0, 20000),
      },
    );
  }

  async findByBullJobId(bullJobId: string): Promise<RecalculateProgressJob | null> {
    return this.repo.findOne({ where: { bullJobId } });
  }

  async findByRecordId(
    recordId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<RecalculateProgressJob | null> {
    return this.repo.findOne({
      where: { jobId: recordId, tenantId, organisationId },
    });
  }

  async list(params: ListRecalculateProgressJobsParams): Promise<{
    items: RecalculateProgressJob[];
    total: number;
  }> {
    const where: FindOptionsWhere<RecalculateProgressJob> = {
      tenantId: params.tenantId,
      organisationId: params.organisationId,
    };
    if (params.courseId) {
      where.courseId = params.courseId;
    }
    if (params.status) {
      where.status = params.status;
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: params.limit,
      skip: params.offset,
    });

    return { items, total };
  }
}
