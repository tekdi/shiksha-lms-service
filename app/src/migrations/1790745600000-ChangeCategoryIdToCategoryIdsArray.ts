import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Changes courses.categoryId and lessons.categoryId (single varchar) into
 * courses.categoryIds and lessons.categoryIds (varchar[]), so a course/lesson can belong
 * to several (externally managed) categories.
 *
 * Existing data is converted in place: 'id1' -> {id1}; NULL and '' -> NULL.
 * The btree indexes are replaced with GIN indexes, which support the array-overlap
 * operator (&&) used by the course/lesson category filters.
 *
 * down() converts back to a single categoryId using the FIRST category; any additional
 * categories are lost on revert.
 */
export class ChangeCategoryIdToCategoryIdsArray1790745600000
  implements MigrationInterface
{
  name = 'ChangeCategoryIdToCategoryIdsArray1790745600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['courses', 'lessons']) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_categoryId"`);
      await queryRunner.query(`
            ALTER TABLE "${table}"
            ALTER COLUMN "categoryId" TYPE character varying[]
            USING CASE
                WHEN "categoryId" IS NULL OR "categoryId" = '' THEN NULL
                ELSE ARRAY["categoryId"]
            END
        `);
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "categoryId" TO "categoryIds"`,
      );
      await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_${table}_categoryIds"
            ON "${table}" USING GIN ("categoryIds")
        `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['courses', 'lessons']) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "IDX_${table}_categoryIds"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "categoryIds" TO "categoryId"`,
      );
      await queryRunner.query(`
            ALTER TABLE "${table}"
            ALTER COLUMN "categoryId" TYPE character varying
            USING "categoryId"[1]
        `);
      await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_${table}_categoryId"
            ON "${table}" ("categoryId")
        `);
    }
  }
}
