import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecalculateProgressJobs1736500000000 implements MigrationInterface {
  name = 'CreateRecalculateProgressJobs1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "recalculate_progress_jobs" (
        "job_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "organisation_id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "bull_job_id" varchar(256),
        "status" varchar(32) NOT NULL DEFAULT 'queued',
        "queued_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "result_json" jsonb,
        "error_message" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recalculate_progress_jobs" PRIMARY KEY ("job_id"),
        CONSTRAINT "UQ_recalculate_progress_jobs_bull_job_id" UNIQUE ("bull_job_id"),
        CONSTRAINT "CHK_recalculate_progress_jobs_status" CHECK ("status" IN (
          'queued', 'running', 'completed', 'failed', 'cancelled'
        ))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_recalculate_progress_jobs_tenant_org_created"
      ON "recalculate_progress_jobs" ("tenant_id", "organisation_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_recalculate_progress_jobs_course_id"
      ON "recalculate_progress_jobs" ("course_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_recalculate_progress_jobs_status"
      ON "recalculate_progress_jobs" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recalculate_progress_jobs"`);
  }
}
