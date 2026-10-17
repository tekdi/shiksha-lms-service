import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CoachCertificateDto {
  @ApiProperty({ description: 'User certificate ID' })
  usercertificateId: string;

  @ApiProperty({ description: 'Course ID the certificate was issued for' })
  courseId: string;

  @ApiProperty({ description: 'Course title' })
  courseTitle: string;

  @ApiPropertyOptional({
    description: 'Certificate type (e.g. certificate, badge)',
    nullable: true,
  })
  certificateType: string | null;

  @ApiPropertyOptional({ description: 'Issued date', nullable: true })
  issuedOn: Date | null;

  @ApiPropertyOptional({ description: 'Certificate URL', nullable: true })
  certificateUrl: string | null;
}

export class CoachJourneyItemDto {
  @ApiProperty({
    description: 'Milestone type',
    enum: [
      'enrolled',
      'lesson_completed',
      'course_completed',
      'certificate_issued',
    ],
  })
  type:
    | 'enrolled'
    | 'lesson_completed'
    | 'course_completed'
    | 'certificate_issued';

  @ApiProperty({
    description: 'Milestone title',
    example: 'Completed: Soil Management Basics',
  })
  title: string;

  @ApiPropertyOptional({ description: 'Milestone date', nullable: true })
  date: Date | null;

  @ApiProperty({ description: 'Course ID' })
  courseId: string;

  @ApiPropertyOptional({ description: 'Lesson ID (lesson milestones only)' })
  lessonId?: string;

  @ApiPropertyOptional({
    description: 'Lesson format (lesson milestones only)',
  })
  format?: string;

  @ApiPropertyOptional({
    description:
      'Lesson sub format, e.g. reflection.prompt (lesson milestones only)',
  })
  subFormat?: string;

  @ApiPropertyOptional({
    description: 'Certificate type (certificate milestones only)',
    nullable: true,
  })
  certificateType?: string | null;
}

export class CoachProgressDto {
  @ApiProperty({ description: 'Coach user ID' })
  userId: string;

  @ApiPropertyOptional({
    description: 'Coach name from the user service',
    nullable: true,
  })
  coachName: string | null;

  @ApiPropertyOptional({
    description: 'Province label from the user service',
    nullable: true,
  })
  province: string | null;

  @ApiPropertyOptional({
    description: 'Province entity ID from the user service',
    nullable: true,
  })
  provinceId: string | null;

  @ApiPropertyOptional({
    description: 'Site label from the user service',
    nullable: true,
  })
  site: string | null;

  @ApiPropertyOptional({
    description: 'Site entity ID from the user service',
    nullable: true,
  })
  siteId: string | null;

  @ApiProperty({
    description: 'Development Pathway (category) IDs of the assigned courses',
    type: [String],
  })
  pathwayIds: string[];

  @ApiProperty({
    description: 'Assigned (published enrollment, non-archived) courses',
  })
  totalCourses: number;

  @ApiProperty({ description: 'Completed assigned courses' })
  completedCourses: number;

  @ApiProperty({
    description:
      'Average progress (0-100) across assigned courses, from course_track lessons',
    example: 85,
  })
  pathwayProgress: number;

  @ApiProperty({
    description: 'Issued certificates count for assigned courses',
  })
  certificatesEarned: number;

  @ApiProperty({
    description: 'Issued certificates for assigned courses',
    type: [CoachCertificateDto],
  })
  certificates: CoachCertificateDto[];

  @ApiPropertyOptional({
    description: 'Learning journey timeline (only when userId is passed)',
    type: [CoachJourneyItemDto],
  })
  journey?: CoachJourneyItemDto[];
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

  @ApiProperty({
    description: 'Issued certificates across all assigned coaches',
    example: 12,
  })
  certificatesEarned: number;

  @ApiProperty({
    description:
      'Assigned coaches (filtered to one coach when userId is passed) with province, site, pathway, progress and certificates',
    type: [CoachProgressDto],
  })
  coaches: CoachProgressDto[];
}
