import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import {
  ProgressRecalculationJob,
  JobStatus,
} from './entities/progress-recalculation-job.entity';
import { Course } from '../courses/entities/course.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';

@Injectable()
@Processor('recalculate-progress')
export class RecalculateProgressQueueService extends WorkerHost {
  private readonly batchSize: number;

  constructor(
    @InjectQueue('recalculate-progress') private readonly queue: Queue,
    @InjectRepository(ProgressRecalculationJob)
    private readonly jobRepo: Repository<ProgressRecalculationJob>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseModule)
    private readonly moduleRepo: Repository<CourseModule>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    super();
    this.batchSize = Number(this.configService.get<string>('RECALCULATE_PROGRESS_BATCH_SIZE', '500'));
  }

  async enqueueJob(
    courseId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<{ jobId: string; message: string }> {
    const jobRecord = this.jobRepo.create({
      courseId,
      tenantId,
      organisationId,
      status: JobStatus.PENDING,
    });
    await this.jobRepo.save(jobRecord);

    await this.queue.add(
      'process',
      { jobId: jobRecord.jobId, courseId, tenantId, organisationId },
      { jobId: jobRecord.jobId },
    );

    return {
      jobId: jobRecord.jobId,
      message: 'Job queued. Use the jobId to track progress.',
    };
  }

  async listJobs(
    tenantId: string,
    organisationId: string,
    courseId?: string,
    status?: JobStatus,
    limit = 20,
    offset = 0,
  ): Promise<{
    data: (ProgressRecalculationJob & { courseName: string | null })[];
    total: number;
  }> {
    const params: unknown[] = [tenantId, organisationId];
    const filters: string[] = [`j."tenantId" = $1`, `j."organisationId" = $2`];

    if (courseId) {
      params.push(courseId);
      filters.push(`j."courseId" = $${params.length}::uuid`);
    }
    if (status) {
      params.push(status);
      filters.push(`j.status = $${params.length}`);
    }

    const where = filters.join(' AND ');

    const [countResult, rows] = await Promise.all([
      this.dataSource.query<{ total: string }[]>(
        `SELECT COUNT(*)::integer AS total FROM progress_recalculation_job j WHERE ${where}`,
        params,
      ),
      this.dataSource.query<(ProgressRecalculationJob & { courseName: string | null })[]>(
        `SELECT j.*, c.title AS "courseName"
         FROM progress_recalculation_job j
         LEFT JOIN courses c ON c."courseId" = j."courseId"
         WHERE ${where}
         ORDER BY j."createdAt" DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    return { data: rows, total: Number(countResult[0]?.total ?? 0) };
  }

  async getJobStatus(
    jobId: string,
    tenantId: string,
    organisationId: string,
  ): Promise<ProgressRecalculationJob> {
    const job = await this.jobRepo.findOne({
      where: { jobId, tenantId, organisationId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  async process(job: Job): Promise<void> {
    const { jobId, courseId, tenantId, organisationId } = job.data;

    await this.jobRepo.update(jobId, { status: JobStatus.PROCESSING });

    try {
      const course = await this.courseRepo.findOne({
        where: { courseId, tenantId, organisationId },
      });
      if (!course) {
        throw new Error(`Course ${courseId} not found`);
      }

      const modules = await this.moduleRepo.find({
        where: { courseId, tenantId, organisationId },
        select: ['moduleId'],
      });
      const moduleIds = modules.map((m) => m.moduleId);

      const [countResult, noOfLessonsResult, moduleLessonCountRows] = await Promise.all([
          this.dataSource.query<{ total: string }[]>(
            `SELECT COUNT(DISTINCT "userId")::integer AS total FROM course_track WHERE "courseId" = $1 AND "tenantId" = $2 AND "organisationId" = $3`,
            [courseId, tenantId, organisationId],
          ),
          // Pre-calculate noOfLessons once — constant for all users in this course
          this.dataSource.query<{ count: string }[]>(
            `SELECT COUNT("lessonId")::integer AS count FROM lessons
             WHERE "courseId" = $1 AND "tenantId" = $2 AND "organisationId" = $3
               AND status = 'published' AND "considerForPassing" = true`,
            [courseId, tenantId, organisationId],
          ),
          // Pre-calculate totalLessons per module once — constant for all users
          moduleIds.length > 0
            ? this.dataSource.query<{ moduleId: string; total: string }[]>(
                `SELECT "moduleId", COUNT("lessonId")::integer AS total FROM lessons
                 WHERE "moduleId" = ANY($1::uuid[]) AND "tenantId" = $2 AND "organisationId" = $3
                   AND status = 'published' AND "considerForPassing" = true
                 GROUP BY "moduleId"`,
                [moduleIds, tenantId, organisationId],
              )
            : Promise.resolve([]),
        ]);

      const totalUsers: number = Number(countResult[0]?.total ?? 0);
      const noOfLessons: number = Number(noOfLessonsResult[0]?.count ?? 0);
      // Map moduleId -> totalLessons for use inside the batch loop
      const moduleTotalMap = new Map<string, number>(
        moduleLessonCountRows.map((r) => [r.moduleId, Number(r.total)]),
      );

      await this.jobRepo.update(jobId, { totalUsers });

      let lastUserId: string | null = null; // keyset cursor
      let processedUsers = 0;

      while (true) {
        const userRows: { userId: string }[] = await this.dataSource.query(
          `SELECT DISTINCT "userId" FROM course_track
           WHERE "courseId" = $1 AND "tenantId" = $2 AND "organisationId" = $3
             AND ($4::uuid IS NULL OR "userId" > $4::uuid)
           ORDER BY "userId" LIMIT $5`,
          [courseId, tenantId, organisationId, lastUserId, this.batchSize],
        );
        const userIds = userRows.map((r) => r.userId);
        if (userIds.length === 0) break;

        // Aggregate completedLessons per userId once for the batch, then join in the UPDATE.
        // Users with zero completions won't appear in lesson_track, so LEFT JOIN via unnest
        // ensures every userId in the batch gets completedLessons = 0.
        await this.dataSource.query(
          `UPDATE course_track ct
           SET
             "noOfLessons"      = $5,
             "completedLessons" = COALESCE(lc.completed, 0)
           FROM (
             SELECT u."userId", COALESCE(agg.completed, 0) AS completed
             FROM unnest($4::uuid[]) AS u("userId")
             LEFT JOIN (
               SELECT lt."userId", COUNT(DISTINCT lt."lessonId")::integer AS completed
               FROM lesson_track lt
               JOIN lessons l ON lt."lessonId" = l."lessonId"
               WHERE lt."courseId" = $1 AND lt."tenantId" = $2 AND lt."organisationId" = $3
                 AND lt."userId" = ANY($4::uuid[])
                 AND lt.status IN ('completed', 'submitted')
                 AND l."considerForPassing" = true AND l.status = 'published'
               GROUP BY lt."userId"
             ) agg ON u."userId" = agg."userId"
           ) lc
           WHERE ct."courseId" = $1 AND ct."tenantId" = $2 AND ct."organisationId" = $3
             AND ct."userId" = lc."userId"`,
          [courseId, tenantId, organisationId, userIds, noOfLessons],
        );

        if (moduleIds.length > 0) {
          // Build a values list of (moduleId, totalLessons) so the UPDATE can join
          // against pre-computed totals instead of re-running a subquery per row.
          const moduleTotalsValues = moduleIds
            .map((_mid, i) => `($${i * 2 + 5}::uuid, $${i * 2 + 6}::integer)`)
            .join(', ');
          const moduleTotalsParams = moduleIds.flatMap((mid) => [mid, moduleTotalMap.get(mid) ?? 0]);

          // Build all joins inside a subquery so mt is only referenced in WHERE (PostgreSQL restriction)
          await this.dataSource.query(
            `UPDATE module_track mt
             SET
               "totalLessons"     = computed.total,
               "completedLessons" = computed.completed,
               progress = CASE
                 WHEN computed.total > 0
                 THEN ROUND((computed.completed::numeric / computed.total::numeric) * 100)
                 ELSE 0
               END,
               status = CASE
                 WHEN computed.total > 0 AND computed.completed >= computed.total THEN 'completed'
                 ELSE 'incomplete'
               END
             FROM (
               SELECT
                 u."userId",
                 mt_totals."moduleId",
                 mt_totals.total,
                 COALESCE(lc.completed, 0) AS completed
               FROM unnest($4::uuid[]) AS u("userId")
               CROSS JOIN (VALUES ${moduleTotalsValues}) AS mt_totals("moduleId", total)
               LEFT JOIN (
                 SELECT lt."userId", l."moduleId", COUNT(DISTINCT lt."lessonId")::integer AS completed
                 FROM lesson_track lt
                 JOIN lessons l ON lt."lessonId" = l."lessonId"
                 WHERE l."moduleId" = ANY($1::uuid[]) AND lt."tenantId" = $2 AND lt."organisationId" = $3
                   AND lt."userId" = ANY($4::uuid[])
                   AND lt.status IN ('completed', 'submitted')
                   AND l."considerForPassing" = true AND l.status = 'published'
                 GROUP BY lt."userId", l."moduleId"
               ) lc ON lc."moduleId" = mt_totals."moduleId" AND lc."userId" = u."userId"
             ) computed
             WHERE mt."tenantId" = $2 AND mt."organisationId" = $3
               AND mt."moduleId" = computed."moduleId"
               AND mt."userId" = computed."userId"`,
            [moduleIds, tenantId, organisationId, userIds, ...moduleTotalsParams],
          );
        }

        processedUsers += userIds.length;
        lastUserId = userIds.at(-1) ?? null;
        await this.jobRepo.update(jobId, { processedUsers });
      }

      await this.jobRepo.update(jobId, { status: JobStatus.COMPLETED });
    } catch (err) {
      await this.jobRepo.update(jobId, {
        status: JobStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
