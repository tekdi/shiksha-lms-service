import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds pdfurl column to user_certificates for the stored certificate PDF (S3 URL).
 */
export class AddPdfUrlToUserCertificates1791004800000 implements MigrationInterface {
  name = 'AddPdfUrlToUserCertificates1791004800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "user_certificates" ADD COLUMN IF NOT EXISTS "pdfurl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "user_certificates" DROP COLUMN IF EXISTS "pdfurl"
    `);
  }
}
