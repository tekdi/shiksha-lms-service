import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds params JSONB column to modules table.
 */
export class AddParamsToModules1790918400000 implements MigrationInterface {
  name = 'AddParamsToModules1790918400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "params" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "modules" DROP COLUMN IF EXISTS "params"
    `);
  }
}
