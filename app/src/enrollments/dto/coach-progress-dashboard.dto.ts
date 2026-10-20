import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { HelperUtil } from '../../common/utils/helper.util';

export class CoachProgressDashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Limit the progress counts to these user IDs (array, repeated userIds[] or comma-separated). Omit for all users.',
    type: [String],
    example: ['3078', '3129'],
  })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const values = HelperUtil.toStringArray(obj[key]);
    return Array.isArray(values) ? Array.from(new Set(values)) : values;
  })
  @IsArray({ message: VALIDATION_MESSAGES.COMMON.ARRAY('userIds') })
  @ArrayNotEmpty({
    message: VALIDATION_MESSAGES.COMMON.MIN_ARRAY_LENGTH('userIds', 1),
  })
  @IsString({
    each: true,
    message: VALIDATION_MESSAGES.COMMON.STRING('userIds'),
  })
  userIds?: string[];
}

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
