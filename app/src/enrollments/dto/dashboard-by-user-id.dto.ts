import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CategoryProgressDto } from './coach-progress-dashboard.dto';

export class DashboardByUserIdDto {
  @ApiProperty({
    description: 'Target user ID for dashboard metrics',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class DashboardByUserIdResponseDto {
  @ApiProperty({
    description:
      'Assigned courses: published enrollments in published courses (same list as users-courses hasEnroll=true)',
    example: 22,
  })
  totalCount: number;

  @ApiProperty({ description: 'Assigned courses with course tracking completed', example: 9 })
  courseCompletionCount: number;

  @ApiProperty({
    description:
      'In progress: assigned courses with course tracking incomplete (users-courses trackingStatus=incomplete)',
    example: 3,
  })
  courseStatusStartedCount: number;

  @ApiProperty({ description: 'Certificate count (default 0 if not set)', example: 4 })
  certificateCount: number;

  @ApiProperty({ description: 'Mandatory due count where enrolledBy and userId are not equal', example: 2 })
  mandatoryDueCount: number;

  @ApiProperty({
    description:
      'The assigned courses counted in totalCount, per category: completed vs total. A course counts towards each of its categories; courses without one are grouped as "other"',
    type: [CategoryProgressDto],
  })
  courses: CategoryProgressDto[];

  @ApiProperty({
    description:
      "Standalone lessons (no course) the user has tracking for, per category, as the lessons list (isStandalone=true, hasTrack=true) shows them: completed vs total, using the status of the user's most recently updated attempt. Lessons without a category are grouped as \"other\". Archived lessons are excluded.",
    type: [CategoryProgressDto],
  })
  lessons: CategoryProgressDto[];
}
