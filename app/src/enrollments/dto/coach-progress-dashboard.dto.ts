import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CoachProgressDashboardDto {
  @ApiPropertyOptional({
    description:
      'Limit every metric to these users. Omitted or empty returns overall statistics.',
    example: ['1001', '1002'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds?: string[];
}

export class CategoryProgressDto {
  @ApiProperty({
    description:
      'Category ID; "other" for courses/lessons without an assigned category',
    example: 'livelihoods',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Completed (user, item) pairs in this category',
    example: 25,
  })
  completedCount: number;

  @ApiProperty({
    description: 'Tracked (user, item) pairs in this category',
    example: 40,
  })
  totalCount: number;
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
    description: 'Issued certificates across all assigned coaches',
    example: 12,
  })
  certificatesEarned: number;

  @ApiProperty({
    description:
      'Course tracking per category (courses.categoryIds): completed vs tracked (user, course) pairs. A course counts towards each of its categories; courses without a category are grouped as "other" (listed last).',
    type: [CategoryProgressDto],
  })
  courses: CategoryProgressDto[];

  @ApiProperty({
    description:
      'Lesson tracking per category (lessons.categoryIds, falling back to the course\'s categoryIds): completed vs tracked (user, lesson) pairs; a lesson is completed when any attempt is completed. A lesson counts towards each of its categories; lessons without a category (on the lesson or its course) are grouped as "other" (listed last).',
    type: [CategoryProgressDto],
  })
  lessons: CategoryProgressDto[];
}
