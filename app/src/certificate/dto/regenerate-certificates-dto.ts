import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegenerateCertificatesDto {
  @ApiProperty({ description: 'User UUID' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description:
      'Credential IDs (certificateId) and/or internal usercertificateId values to regenerate',
    type: [String],
    example: ['did:rcw:abc', 'f1474276-70d5-4a28-b4fa-0baf40f1b0a3'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  certificateIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issuanceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Course name embedded in the credential (defaults to "Course")',
  })
  @IsOptional()
  @IsString()
  courseName?: string;

  @ApiPropertyOptional({ description: 'Used for LMS status update when provided' })
  @IsOptional()
  @IsString()
  courseTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuedOn?: string;
}
