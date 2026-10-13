import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

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

  @IsUUID()
  @IsString()
  userId: string;

  @IsString()
  courseId: string;

  @IsString()
  courseName: string;
}
