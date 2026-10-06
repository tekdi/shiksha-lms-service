import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchTrackedLessonsDto {
  @ApiPropertyOptional({ description: 'Filter lessons from library (standalone lessons)', example: '1' })
  @IsOptional()
  @IsString()
  lessonsFromLibrary?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Search term for lesson title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter only attempted lessons' })
  @IsOptional()
  @IsString()
  onlyAttempted?: string;

  @ApiPropertyOptional({ description: 'Filter not attempted lessons' })
  @IsOptional()
  @IsString()
  notAttempted?: string;

  @ApiPropertyOptional({ description: 'User ID (overrides logged in user if provided)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Limit', example: 10, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
  
  @ApiPropertyOptional({ description: 'Offset', example: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class TrackedLessonsResponseDto {
  @ApiProperty({ description: 'List of tracked lessons matching the criteria' })
  lessons: any[];

  @ApiProperty({ description: 'Total number of tracked lessons matching the criteria', example: 1 })
  @IsNumber()
  totalElements: number;

  @ApiProperty({ description: 'Number of items skipped (offset)', example: 0 })
  @IsNumber()
  offset: number;

  @ApiProperty({ description: 'Number of items returned (limit)', example: 10 })
  @IsNumber()
  limit: number;
}
