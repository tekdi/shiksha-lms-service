import { ApiProperty } from '@nestjs/swagger';

export class CategoryProgressDto {
  @ApiProperty({
    description:
      'Category (Development Pathway) ID from the LMS categories API',
    example: '6abe2911fafe2f0015172b8e',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Courses or standalone contents in this category',
    example: 20,
  })
  totalCount: number;

  @ApiProperty({
    description:
      'Completed assigned items (one per coach per item) in this category',
    example: 8,
  })
  completedCount: number;
}

export class CoachProgressDashboardResponseDto {
  @ApiProperty({
    description:
      'Distinct coaches with at least one published course enrollment',
    example: 40,
  })
  coachesAssigned: number;

  @ApiProperty({
    description:
      'Completed courses across all coaches (one per coach per course)',
    example: 18,
  })
  coursesCompleted: number;

  @ApiProperty({
    description:
      'Completed modules across all coaches (one per coach per module)',
    example: 64,
  })
  modulesCompleted: number;

  @ApiProperty({
    description:
      'Completed content (lessons) across all coaches (one per coach per lesson)',
    example: 230,
  })
  contentCompleted: number;

  @ApiProperty({
    description:
      'Per LMS category: published courses and how many of them are completed (course_track completed)',
    type: [CategoryProgressDto],
  })
  completedCoursesByCategory: CategoryProgressDto[];

  @ApiProperty({
    description:
      'Per LMS category: published standalone content (lessons outside any course/module) and how much of it is completed (lesson_track completed)',
    type: [CategoryProgressDto],
  })
  completedContentsByCategory: CategoryProgressDto[];
}
