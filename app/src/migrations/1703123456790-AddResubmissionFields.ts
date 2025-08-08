import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResubmissionFields1703123456790 implements MigrationInterface {
    name = 'AddResubmissionFields1703123456790'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add allowResubmission field to lessons table
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            ADD COLUMN "allowResubmission" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove allowResubmission field from lessons table
        await queryRunner.query(`
            ALTER TABLE "lessons" 
            DROP COLUMN "allowResubmission"
        `);
    }
} 