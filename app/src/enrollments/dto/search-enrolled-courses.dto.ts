import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
  ValidateIf,
  ValidateBy,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Course } from '../../courses/entities/course.entity';
import { CourseTrack, TrackingStatus } from '../../tracking/entities/course-track.entity';
import { UserEnrollment } from '../entities/user-enrollment.entity';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { HelperUtil } from '../../common/utils/helper.util';

export class UsersEnrolledCoursesDto {
  @ApiPropertyOptional({ description: 'Filter by cohort ID' })
  @IsOptional()
  @IsString()
  cohortId?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID (required when hasEnroll is provided)',
  })
  // Optional as before, unless hasEnroll is provided
  @ValidateIf(
    (o: UsersEnrolledCoursesDto) =>
      o.hasEnroll !== undefined ||
      (o.userId !== undefined && o.userId !== null),
  )
  @IsString()
  @ValidateBy({
    name: 'requiredWithHasEnroll',
    validator: {
      validate: (value: unknown, args) =>
        (args?.object as UsersEnrolledCoursesDto).hasEnroll === undefined ||
        (typeof value === 'string' && value.trim() !== ''),
      defaultMessage: () => VALIDATION_MESSAGES.COMMON.REQUIRED('User ID'),
    },
  })
  userId?: string;

  @ApiPropertyOptional({
    description:
      "true: the user's enrolled courses with totalModuleCount, completedModuleCount, courseTracking and enrollment. false: courses the user is NOT enrolled in. Omit for the existing behaviour. Requires userId.",
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
    description: 'Filter by course tracking status (only applies when hasEnroll=true)',
    enum: TrackingStatus,
  })
  @IsOptional()
  @IsEnum(TrackingStatus, {
    message: VALIDATION_MESSAGES.COMMON.ENUM('Tracking status'),
  })
  trackingStatus?: TrackingStatus;

  @ApiPropertyOptional({ description: 'Filter by pathway ID' })
  @IsOptional()
  @IsString()
  pathwayId?: string;

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

export class UserEnrolledCourseDto extends Course {
  @ApiPropertyOptional({
    description: 'Number of non-archived modules in the course',
  })
  totalModuleCount?: number;

  @ApiPropertyOptional({
    description: 'Sum of daysAllocation across all non-archived modules in the course',
  })
  daysAllocationCount?: number;

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

export class UsersEnrolledCoursesResponseDto {
  @ApiProperty({
    description: 'List of enrolled courses matching the search criteria',
    type: [UserEnrolledCourseDto],
  })
  courses: UserEnrolledCourseDto[];

  @ApiProperty({ description: 'Total number of enrolled courses matching the criteria', example: 1 })
  @IsNumber()
  totalElements: number;

  @ApiProperty({ description: 'Number of items skipped (offset)', example: 0 })
  @IsNumber()
  offset: number;

  @ApiProperty({ description: 'Number of items returned (limit)', example: 10 })
  @IsNumber()
  limit: number;
} 