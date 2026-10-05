import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsEnum, IsUUID, IsDateString, IsNumber, Min, IsArray, IsNotEmpty, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CourseStatus } from '../entities/course.entity';
import { Course } from '../entities/course.entity';
import { HelperUtil } from '../../common/utils/helper.util';
import { CourseTrack } from '../../tracking/entities/course-track.entity';
import { UserEnrollment } from '../../enrollments/entities/user-enrollment.entity';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export enum SortBy {
  ORDERING = 'ordering',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  START_DATETIME = 'startDatetime',
  END_DATETIME = 'endDatetime',
  FEATURED = 'featured',
  FREE = 'free'
}

export class SearchCourseDto {
  @ApiPropertyOptional({ description: 'Search keyword to match in title, description, or short description' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by cohort ID' })
  @IsOptional()
  @IsString()
  cohortId?: string;

  @ApiPropertyOptional({ description: 'Filter by pathway ID' })
  @IsOptional()
  @IsString()
  pathwayId?: string;

  @ApiPropertyOptional({ enum: CourseStatus, description: 'Filter by course status' })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Filter by featured status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Filter by free/paid status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  free?: boolean;

  @ApiPropertyOptional({ description: 'Filter by start date (from)', type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  startDateFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter by start date (to)', type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  startDateTo?: Date;

  @ApiPropertyOptional({ description: 'Filter by end date (from)', type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  endDateFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter by end date (to)', type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  endDateTo?: Date;

  @ApiPropertyOptional({
    description: 'Filter by one or more category IDs (comma-separated or repeated). Returns courses in any of the given categories.',
    type: [String],
    example: '123,456',
  })
  @IsOptional()
  @Transform(({ obj, key }) => HelperUtil.toStringArray(obj[key]))
  @IsArray()
  @IsString({ each: true, message: 'Each category ID must be a string' })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description:
      'Enrollment filter for userId. true: only courses the user is enrolled in, with completedModuleCount, courseTracking and enrollment. false: only courses the user is NOT enrolled in. Omit for the existing behaviour.',
  })
  @IsOptional()
  // Read the raw query value: implicit conversion would turn the string "false" into true
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    if (obj[key] === 'true') return true;
    if (obj[key] === 'false') return false;
    return obj[key];
  })
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('hasEnroll') })
  hasEnroll?: boolean;

  @ApiPropertyOptional({
    description: 'User ID (required when hasEnroll is provided)',
  })
  @ValidateIf((o: SearchCourseDto) => o.hasEnroll !== undefined)
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('User ID') })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('User ID') })
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by creator user ID' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

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
    description: 'Sort order (ASC or DESC)', 
    example: SortOrder.DESC,
    default: SortOrder.DESC
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return SortOrder.DESC;
    }
    if (typeof value === 'string') {
      const upperValue = value.toUpperCase().trim();
      if (upperValue === 'ASC') {
        return SortOrder.ASC;
      }
      if (upperValue === 'DESC') {
        return SortOrder.DESC;
      }
    }
    // If it's already an enum value, return as is
    if (value === SortOrder.ASC || value === SortOrder.DESC) {
      return value;
    }
    return SortOrder.DESC;
  })
  @IsEnum(SortOrder)
  orderBy?: SortOrder = SortOrder.DESC;
}

export class SearchCourseItemDto extends Course {
  @ApiProperty({ description: 'Number of non-archived modules in the course' })
  moduleCount: number;

  @ApiProperty({
    description: 'Number of published enrollments for the course',
  })
  enrolledUsersCount: number;

  @ApiPropertyOptional({
    description: 'Modules the user has completed (only when hasEnroll=true)',
  })
  completedModuleCount?: number;

  @ApiPropertyOptional({
    type: CourseTrack,
    nullable: true,
    description:
      "The user's latest course tracking (only when hasEnroll=true; null if not started)",
  })
  courseTracking?: CourseTrack | null;

  @ApiPropertyOptional({
    type: UserEnrollment,
    nullable: true,
    description:
      "The user's latest published enrollment (only when hasEnroll=true)",
  })
  enrollment?: UserEnrollment | null;
}

export class SearchCourseResponseDto {
  @ApiProperty({
    description: 'List of courses matching the search criteria',
    type: [SearchCourseItemDto],
  })
  courses: SearchCourseItemDto[];

  @ApiProperty({ description: 'Total number of courses matching the criteria', example: 1 })
  @IsNumber()
  totalElements: number;

  @ApiProperty({ description: 'Number of items skipped (offset)', example: 0 })
  @IsNumber()
  offset: number;

  @ApiProperty({ description: 'Number of items returned (limit)', example: 10 })
  @IsNumber()
  limit: number;
} 