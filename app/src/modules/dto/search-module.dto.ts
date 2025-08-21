import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsEnum, IsUUID, IsDateString, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ModuleStatus } from '../entities/module.entity';
import { Module } from '../entities/module.entity';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export enum SortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  START_DATETIME = 'startDatetime',
  END_DATETIME = 'endDatetime',
  ORDERING = 'ordering'
}

export class SearchModuleDto {
  @ApiPropertyOptional({ description: 'Search keyword to match in title or description' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by course ID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Filter by parent module ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ enum: ModuleStatus, description: 'Filter by module status' })
  @IsOptional()
  @IsEnum(ModuleStatus)
  status?: ModuleStatus;


  @ApiPropertyOptional({ description: 'Number of items to skip (offset)', example: 0, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Number of items to return (limit)', example: 10, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    enum: SortBy, 
    description: 'Field to sort by', 
    example: SortBy.ORDERING,
    default: SortBy.ORDERING
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.ORDERING;

  @ApiPropertyOptional({ 
    enum: SortOrder, 
    description: 'Sort order', 
    example: SortOrder.ASC,
    default: SortOrder.ASC
  })
  @IsOptional()
  @IsEnum(SortOrder)
  orderBy?: SortOrder = SortOrder.ASC;
}

export class SearchModuleResponseDto {
  @ApiProperty({ description: 'List of modules matching the search criteria', type: [Module] })
  modules: Module[];

  @ApiProperty({ description: 'Total number of modules matching the criteria', example: 1 })
  @IsNumber()
  totalElements: number;

  @ApiProperty({ description: 'Number of items skipped (offset)', example: 0 })
  @IsNumber()
  offset: number;

  @ApiProperty({ description: 'Number of items returned (limit)', example: 10 })
  @IsNumber()
  limit: number;
} 