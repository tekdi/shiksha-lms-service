import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DashboardByUserIdDto {
  @ApiProperty({
    description: 'Target user ID for dashboard metrics',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class CategoryCountDto {
  @ApiProperty({ description: 'Category ID', example: 'livelihoods' })
  @IsString()
  categoryId: string;

  @ApiProperty({ description: 'Completed count for this category', example: 5 })
  count: number;
}

export class CategoryProgressCountDto extends CategoryCountDto {
  @ApiProperty({
    description: 'Items in this category assigned or available to the user',
    example: 8,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Items in this category completed by the user (same as count)',
    example: 5,
  })
  completedCount: number;
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
      'Courses assigned to the user (published enrollment, non-archived course) categoryId wise, with how many of them the user completed',
    type: [CategoryProgressCountDto],
  })
  completedCoursesByCategory: CategoryProgressCountDto[];

  @ApiProperty({
    description:
      'Published standalone contents (parent lessons outside any course/module) categoryId wise, with how many of them the user completed',
    type: [CategoryProgressCountDto],
  })
  completedContentsByCategory: CategoryProgressCountDto[];

  @ApiProperty({
    description: 'Completed standalone lessons (courseId IS NULL AND moduleId IS NULL) count categoryId wise',
    type: [CategoryCountDto],
  })
  completedStandaloneLessonsByCategory: CategoryCountDto[];
}
