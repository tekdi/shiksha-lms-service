import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RecalculateProgressJobStatus } from '../entities/recalculate-progress-job.entity';

export class ListRecalculateProgressJobsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by course' })
  @IsOptional()
  @IsUUID('4')
  courseId?: string;

  @ApiPropertyOptional({ enum: RecalculateProgressJobStatus })
  @IsOptional()
  @IsEnum(RecalculateProgressJobStatus)
  status?: RecalculateProgressJobStatus;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
