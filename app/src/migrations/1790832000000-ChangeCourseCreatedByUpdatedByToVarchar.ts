import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * courses.createdBy / courses.updatedBy were uuid, but user IDs are plain strings (e.g. "3078"),
 * like createdBy/updatedBy on every other table. Existing UUID values are kept as text.
 *
 * down() converts back to uuid; values that are not valid UUIDs become NULL.
 */
export class ChangeCourseCreatedByUpdatedByToVarchar1790832000000
  implements MigrationInterface
{
  name = 'ChangeCourseCreatedByUpdatedByToVarchar1790832000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['createdBy', 'updatedBy']) {
      await queryRunner.query(
        `ALTER TABLE "courses" ALTER COLUMN "${column}" TYPE character varying USING "${column}"::text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['createdBy', 'updatedBy']) {
      await queryRunner.query(`
            ALTER TABLE "courses" ALTER COLUMN "${column}" TYPE uuid
            USING CASE
                WHEN "${column}" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN "${column}"::uuid
                ELSE NULL
            END
        `);
    }
  }
}
