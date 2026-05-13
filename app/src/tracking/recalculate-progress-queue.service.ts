import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere } from 'typeorm';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import {
  ProgressRecalculationJob,
  JobStatus,
} from './entities/progress-recalculation-job.entity';
import { Course } from '../courses/entities/course.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';

const BATCH_SIZE = 500;

@Injectable()
@Processor('recalculate-progress')
export class RecalculateProgressQueueService extends WorkerHost {
  constructor(
    @InjectQueue('recalculate-progress') private readonly queue: Queue,
    @InjectRepository(ProgressRecalculationJob)
    private readonly jobRepo: Repository<ProgressRecalculationJob>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseModule)
    private readonly moduleRepo: Repository<CourseModule>,
    private readonly dataSource: DataSource,
  ) {
    super();
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
  ): Promise<{ data: ProgressRecalculationJob[]; total: number }> {
    const where: FindOptionsWhere<ProgressRecalculationJob> = { tenantId, organisationId };
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;

    const [data, total] = await this.jobRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
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

      const countResult = await this.dataSource.query(
        `SELECT COUNT(DISTINCT "userId")::integer AS total FROM course_track WHERE "courseId" = $1 AND "tenantId" = $2 AND "organisationId" = $3`,
        [courseId, tenantId, organisationId],
      );
      const totalUsers: number = Number(countResult[0]?.total ?? 0);

      await this.jobRepo.update(jobId, { totalUsers });

      let offset = 0;
      let processedUsers = 0;

      while (offset < totalUsers) {
        const userRows: { userId: string }[] = await this.dataSource.query(
          `SELECT DISTINCT "userId" FROM course_track WHERE "courseId" = $1 AND "tenantId" = $2 AND "organisationId" = $3 ORDER BY "userId" LIMIT $4 OFFSET $5`,
          [courseId, tenantId, organisationId, BATCH_SIZE, offset],
        );
        const userIds = userRows.map((r) => r.userId);
        if (userIds.length === 0) break;

        await this.dataSource.query(
          `UPDATE course_track ct
          SET
            "noOfLessons" = COALESCE((
              SELECT COUNT(l."lessonId")::integer FROM lessons l
              WHERE l."courseId" = ct."courseId" AND l."tenantId" = ct."tenantId"
                AND l."organisationId" = ct."organisationId"
                AND l.status = 'published' AND l."considerForPassing" = true
            ), 0),
            "completedLessons" = COALESCE((
              SELECT COUNT(DISTINCT lt."lessonId")::integer FROM lesson_track lt
              JOIN lessons l ON lt."lessonId" = l."lessonId"
              WHERE lt."userId" = ct."userId" AND lt."courseId" = ct."courseId"
                AND lt."tenantId" = ct."tenantId" AND lt."organisationId" = ct."organisationId"
                AND lt.status IN ('completed', 'submitted')
                AND l."considerForPassing" = true AND l.status = 'published'
            ), 0),
            status = CASE
              WHEN COALESCE((SELECT COUNT(DISTINCT lt."lessonId")::integer FROM lesson_track lt
                JOIN lessons l ON lt."lessonId" = l."lessonId"
                WHERE lt."userId" = ct."userId" AND lt."courseId" = ct."courseId"
                  AND lt."tenantId" = ct."tenantId" AND lt."organisationId" = ct."organisationId"
                  AND lt.status IN ('completed', 'submitted')
                  AND l."considerForPassing" = true AND l.status = 'published'), 0) = 0 THEN 'not_started'
              WHEN COALESCE((SELECT COUNT(DISTINCT lt."lessonId")::integer FROM lesson_track lt
                JOIN lessons l ON lt."lessonId" = l."lessonId"
                WHERE lt."userId" = ct."userId" AND lt."courseId" = ct."courseId"
                  AND lt."tenantId" = ct."tenantId" AND lt."organisationId" = ct."organisationId"
                  AND lt.status IN ('completed', 'submitted')
                  AND l."considerForPassing" = true AND l.status = 'published'), 0) >= COALESCE((
                    SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                    WHERE l2."courseId" = ct."courseId" AND l2."tenantId" = ct."tenantId"
                      AND l2."organisationId" = ct."organisationId"
                      AND l2.status = 'published' AND l2."considerForPassing" = true
                  ), 0) AND COALESCE((SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                    WHERE l2."courseId" = ct."courseId" AND l2."tenantId" = ct."tenantId"
                      AND l2."organisationId" = ct."organisationId"
                      AND l2.status = 'published' AND l2."considerForPassing" = true
                  ), 0) > 0 THEN 'completed'
              ELSE 'incomplete'
            END
          WHERE ct."courseId" = $1 AND ct."tenantId" = $2 AND ct."organisationId" = $3
            AND ct."userId" = ANY($4::uuid[])`,
          [courseId, tenantId, organisationId, userIds],
        );

        if (moduleIds.length > 0) {
          await this.dataSource.query(
            `UPDATE module_track mt
            SET
              "totalLessons" = COALESCE((
                SELECT COUNT(l."lessonId")::integer FROM lessons l
                WHERE l."moduleId" = mt."moduleId" AND l."tenantId" = mt."tenantId"
                  AND l."organisationId" = mt."organisationId"
                  AND l.status = 'published' AND l."considerForPassing" = true
              ), 0),
              "completedLessons" = COALESCE((
                SELECT COUNT(DISTINCT lt."lessonId")::integer FROM lesson_track lt
                JOIN lessons l ON lt."lessonId" = l."lessonId"
                WHERE lt."userId" = mt."userId" AND l."moduleId" = mt."moduleId"
                  AND lt."tenantId" = mt."tenantId" AND lt."organisationId" = mt."organisationId"
                  AND lt.status IN ('completed', 'submitted')
                  AND l."considerForPassing" = true AND l.status = 'published'
              ), 0),
              progress = CASE
                WHEN COALESCE((SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                  WHERE l2."moduleId" = mt."moduleId" AND l2."tenantId" = mt."tenantId"
                    AND l2."organisationId" = mt."organisationId"
                    AND l2.status = 'published' AND l2."considerForPassing" = true), 0) > 0
                THEN ROUND((COALESCE((
                  SELECT COUNT(DISTINCT lt2."lessonId")::integer FROM lesson_track lt2
                  JOIN lessons l3 ON lt2."lessonId" = l3."lessonId"
                  WHERE lt2."userId" = mt."userId" AND l3."moduleId" = mt."moduleId"
                    AND lt2."tenantId" = mt."tenantId" AND lt2."organisationId" = mt."organisationId"
                    AND lt2.status IN ('completed', 'submitted')
                    AND l3."considerForPassing" = true AND l3.status = 'published'
                ), 0)::numeric / (SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                  WHERE l2."moduleId" = mt."moduleId" AND l2."tenantId" = mt."tenantId"
                    AND l2."organisationId" = mt."organisationId"
                    AND l2.status = 'published' AND l2."considerForPassing" = true)::numeric) * 100)
                ELSE 0
              END,
              status = CASE
                WHEN COALESCE((SELECT COUNT(DISTINCT lt."lessonId")::integer FROM lesson_track lt
                  JOIN lessons l ON lt."lessonId" = l."lessonId"
                  WHERE lt."userId" = mt."userId" AND l."moduleId" = mt."moduleId"
                    AND lt."tenantId" = mt."tenantId" AND lt."organisationId" = mt."organisationId"
                    AND lt.status IN ('completed', 'submitted')
                    AND l."considerForPassing" = true AND l.status = 'published'), 0) >= COALESCE((
                      SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                      WHERE l2."moduleId" = mt."moduleId" AND l2."tenantId" = mt."tenantId"
                        AND l2."organisationId" = mt."organisationId"
                        AND l2.status = 'published' AND l2."considerForPassing" = true
                    ), 0) AND COALESCE((SELECT COUNT(l2."lessonId")::integer FROM lessons l2
                      WHERE l2."moduleId" = mt."moduleId" AND l2."tenantId" = mt."tenantId"
                        AND l2."organisationId" = mt."organisationId"
                        AND l2.status = 'published' AND l2."considerForPassing" = true
                    ), 0) > 0 THEN 'completed'
                ELSE 'incomplete'
              END
            WHERE mt."tenantId" = $1 AND mt."organisationId" = $2
              AND mt."moduleId" = ANY($3::uuid[])
              AND mt."userId" = ANY($4::uuid[])`,
            [tenantId, organisationId, moduleIds, userIds],
          );
        }

        processedUsers += userIds.length;
        offset += BATCH_SIZE;
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
