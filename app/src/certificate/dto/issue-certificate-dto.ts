import { IsDateString, IsOptional, IsString } from 'class-validator';

export class IssueCredentialDto {
  @IsOptional()
  @IsDateString()
  issuanceDate?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  courseName: string;

  // Optional pre‑generated DID for testing when the identity service is unavailable
  @IsOptional()
  @IsString()
  learnerDid?: string;
}
