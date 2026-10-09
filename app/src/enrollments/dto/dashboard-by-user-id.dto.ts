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

export class DashboardByUserIdResponseDto {
  @ApiProperty({ description: 'Total count of status completed of enrolled course', example: 5 })
  totalCount: number;

  @ApiProperty({ description: 'Track completion count', example: 5 })
  trackCompletionCount: number;

  @ApiProperty({ description: 'Track status started count', example: 3 })
  trackStatusStartedCount: number;

  @ApiProperty({ description: 'Certificate count (default 0 if not set)', example: 4 })
  certificateCount: number;

  @ApiProperty({ description: 'Mandatory due count where enrolledBy and userId are not equal', example: 2 })
  mandatoryDueCount: number;

  @ApiProperty({
    description: 'Completed courses count categoryId wise',
    type: [CategoryCountDto],
  })
  completedCoursesByCategory: CategoryCountDto[];

  @ApiProperty({
    description: 'Completed standalone lessons (courseId IS NULL AND moduleId IS NULL) count categoryId wise',
    type: [CategoryCountDto],
  })
  completedStandaloneLessonsByCategory: CategoryCountDto[];
}
