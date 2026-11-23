import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 34 (Swadhaar): course language and language versions.
 *
 * - language: content language code (en / hi / mr), default en.
 * - translationGroupId: the English, Hindi and Marathi versions of one course share it.
 *   A course with no other versions has its own courseId here.
 * - sourceCourseId: the course a version was copied from (Task 35 "create version").
 *
 * Backfill: params.language ('english' / 'hindi' / 'marathi' or a code) when set, else Hindi when the
 * title has Devanagari letters, else English; translationGroupId = courseId.
 * One live (not archived) course per language in a group: a second Hindi version is refused.
 */
export class AddCourseLanguageMapping1763900000000 implements MigrationInterface {
  name = 'AddCourseLanguageMapping1763900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD COLUMN IF NOT EXISTS "language" varchar(10) NOT NULL DEFAULT 'en',
        ADD COLUMN IF NOT EXISTS "translationGroupId" uuid NULL,
        ADD COLUMN IF NOT EXISTS "sourceCourseId" uuid NULL
    `);

    await queryRunner.query(`
      UPDATE "courses" SET "language" = CASE
        WHEN lower(trim("params"->>'language')) IN ('en', 'english') THEN 'en'
        WHEN lower(trim("params"->>'language')) IN ('hi', 'hindi') THEN 'hi'
        WHEN lower(trim("params"->>'language')) IN ('mr', 'marathi') THEN 'mr'
        WHEN "title" ~ '[\\u0900-\\u097F]' THEN 'hi'
        ELSE 'en'
      END
    `);
    await queryRunner.query(
      `UPDATE "courses" SET "translationGroupId" = "courseId" WHERE "translationGroupId" IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD CONSTRAINT "chk_courses_language" CHECK ("language" IN ('en', 'hi', 'mr')),
        ADD CONSTRAINT "fk_courses_source_course" FOREIGN KEY ("sourceCourseId")
          REFERENCES "courses"("courseId") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_tenant_language" ON "courses" ("tenantId", "language")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_courses_translation_group" ON "courses" ("translationGroupId")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_courses_translation_group_language"
        ON "courses" ("translationGroupId", "language")
        WHERE "translationGroupId" IS NOT NULL AND "status" <> 'archived'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_courses_translation_group_language"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_courses_translation_group"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_courses_tenant_language"`,
    );
    await queryRunner.query(`
      ALTER TABLE "courses"
        DROP CONSTRAINT IF EXISTS "fk_courses_source_course",
        DROP CONSTRAINT IF EXISTS "chk_courses_language",
        DROP COLUMN IF EXISTS "sourceCourseId",
        DROP COLUMN IF EXISTS "translationGroupId",
        DROP COLUMN IF EXISTS "language"
    `);
  }
}
