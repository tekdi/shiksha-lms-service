import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, IsString, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CourseReportHeadersDto {
  @ApiProperty({
    description: 'Authentication token for external API calls',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: 'string'
  })
  @IsString()
  authorization: string;
}

export class CourseReportDto {
  @ApiProperty({
    description: 'Target course ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid'
  })
  @IsUUID()
  courseId: string;

  @ApiProperty({
    description: 'Associated cohort ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
    type: 'string',
    format: 'uuid'
  })
  @IsUUID()
  cohortId: string;

  @ApiProperty({
    description: 'Required only for content-level report',
    example: '123e4567-e89b-12d3-a456-426614174002',
    type: 'string',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiProperty({
    description: 'Offset for pagination',
    example: 0,
    type: 'number',
    required: false,
    default: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({
    description: 'Limit for pagination',
    example: 10,
    type: 'number',
    required: false,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Field to sort by',
    example: 'progress',
    type: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'progress';

  @ApiProperty({
    description: 'Sort order',
    example: 'desc',
    type: 'string',
    required: false,
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  orderBy?: string = 'desc';
} 