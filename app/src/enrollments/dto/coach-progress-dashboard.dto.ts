import { ApiProperty } from '@nestjs/swagger';

export class PathwayCompletionDto {
  @ApiProperty({
    description: 'Category (Development Pathway) ID',
    example: 'livelihoods',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Completed content (lesson) count for this pathway',
    example: 12,
  })
  completedCount: number;

  @ApiProperty({
    description:
      'Share of overall completed content that belongs to this pathway (0-100). Content tagged with several pathways counts towards each.',
    example: 25.5,
  })
  percentage: number;
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
      'Completed content grouped by Development Pathway (category ID)',
    type: [PathwayCompletionDto],
  })
  completedByPathway: PathwayCompletionDto[];
}
