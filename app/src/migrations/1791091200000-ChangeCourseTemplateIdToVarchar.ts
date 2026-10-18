import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Changes courses.templateId from uuid to varchar: credentials-service template ids
 * (e.g. 'cmv7rfjir000ips0pvhya6ikr') are not UUIDs.
 */
export class ChangeCourseTemplateIdToVarchar1791091200000 implements MigrationInterface {
  name = 'ChangeCourseTemplateIdToVarchar1791091200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courses" ALTER COLUMN "templateId" TYPE varchar USING "templateId"::varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Fails if non-UUID template ids have been stored since the up migration
    await queryRunner.query(`
      ALTER TABLE "courses" ALTER COLUMN "templateId" TYPE uuid USING "templateId"::uuid
    `);
  }
}
