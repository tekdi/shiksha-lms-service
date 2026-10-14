import { IsOptional, IsArray, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetUserCertificatesDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of records per page',
    example: 10,
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by user IDs (array)',
    example: ['f1474276-70d5-4a28-b4fa-0baf40f1b0a3'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiProperty({
    description: 'Filter by certificate IDs (array)',
    example: ['did:rcw:a0242e29-2774-4e5d-bddb-4a62dcd3e318'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateIds?: string[];

  @ApiProperty({
    description: 'Filter by course IDs (array)',
    example: ['6409e76a-48f1-42b3-abf2-c79b8170cf96'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courseIds?: string[];

  @ApiProperty({
    description: 'Filter by template IDs (array)',
    example: ['cmems877c000aqq0i9k1s7ggf'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  templateIds?: string[];

  @ApiProperty({
    description:
      'Filter by certificate types (array). The acknowledgement type is never returned; paid_acknowledgement is returned when applicable.',
    example: ['course', 'assessment', 'certificate'],
    required: false,
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificateTypes?: string[];
} 