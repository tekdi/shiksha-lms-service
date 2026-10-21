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
  @ApiProperty({ description: 'Total count of enrolled courses for the user', example: 5 })
  totalCount: number;

  @ApiProperty({ description: 'Course completion count', example: 5 })
  courseCompletionCount: number;

  @ApiProperty({ description: 'Course status started count', example: 3 })
  courseStatusStartedCount: number;

  @ApiProperty({ description: 'Certificate count (default 0 if not set)', example: 4 })
  certificateCount: number;

  @ApiProperty({ description: 'Mandatory due count where enrolledBy and userId are not equal', example: 2 })
  mandatoryDueCount: number;

  @ApiProperty({
    description:
      'Course tracking per category for the user: completed vs tracked courses (courses.categoryIds; "other" when a course has none). Archived courses are excluded.',
    type: [CategoryProgressDto],
  })
  courses: CategoryProgressDto[];

  @ApiProperty({
    description:
      "Lesson tracking per category for the user (course and standalone lessons): completed vs tracked lessons (lessons.categoryIds, falling back to the course's; \"other\" when neither has one). A lesson is completed when any attempt is completed. Archived lessons are excluded.",
    type: [CategoryProgressDto],
  })
  lessons: CategoryProgressDto[];
}
