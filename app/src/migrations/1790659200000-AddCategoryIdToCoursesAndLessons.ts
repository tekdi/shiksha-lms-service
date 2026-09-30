import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a categoryId reference on courses and lessons.
 *
 * categoryId is mandatory at the API level for newly created courses/lessons, but the
 * columns are nullable because existing rows have no category and there is no safe
 * default to backfill. Once existing data has been assigned categories, a follow-up
 * migration can make the columns NOT NULL.
 *
 * Statements use IF (NOT) EXISTS so the migration is safe to run against databases whose
 * schema is managed outside this repository.
 */
export class AddCategoryIdToCoursesAndLessons1790659200000
  implements MigrationInterface
{
  name = 'AddCategoryIdToCoursesAndLessons1790659200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "categoryId" character varying
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_courses_categoryId" ON "courses" ("categoryId")
        `);

    await queryRunner.query(`
            ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "categoryId" character varying
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_lessons_categoryId" ON "lessons" ("categoryId")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lessons_categoryId"`);
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP COLUMN IF EXISTS "categoryId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_courses_categoryId"`);
    await queryRunner.query(
      `ALTER TABLE "courses" DROP COLUMN IF EXISTS "categoryId"`,
    );
  }
}
