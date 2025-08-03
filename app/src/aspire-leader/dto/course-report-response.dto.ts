import { ApiProperty } from '@nestjs/swagger';

export class CourseLevelReportItemDto {
  @ApiProperty({
    description: 'User name',
    example: 'Vijay Johnson',
    type: 'string'
  })
  user: string;

  @ApiProperty({
    description: 'User email',
    example: 'avijaysss@yopmail.com',
    type: 'string'
  })
  email: string;

  @ApiProperty({
    description: 'Cohort name',
    example: 'Cohort 23 June',
    type: 'string'
  })
  cohort: string;

  @ApiProperty({
    description: 'Course name',
    example: 'Leadership Basics',
    type: 'string'
  })
  course: string;

  @ApiProperty({
    description: 'Progress percentage',
    example: 75,
    type: 'number'
  })
  progress: number;

  @ApiProperty({
    description: 'Last accessed date',
    example: '2025-03-15',
    type: 'string',
    format: 'date'
  })
  lastAccessed: string;
}

export class LessonLevelReportItemDto {
  @ApiProperty({
    description: 'User name',
    example: 'Tushar Johnson',
    type: 'string'
  })
  user: string;

  @ApiProperty({
    description: 'Course name',
    example: 'Leadership Basics',
    type: 'string'
  })
  course: string;

  @ApiProperty({
    description: 'Lesson title',
    example: 'Leadership Introduction',
    type: 'string'
  })
  lessonTitle: string;

  @ApiProperty({
    description: 'Content type',
    example: 'Video',
    type: 'string'
  })
  type: string;

  @ApiProperty({
    description: 'Progress percentage',
    example: 30,
    type: 'number'
  })
  progress: number;

  @ApiProperty({
    description: 'Time spent in minutes',
    example: 40,
    type: 'number'
  })
  timeSpentMins: number;

  @ApiProperty({
    description: 'Attempt number',
    example: 2,
    type: 'number'
  })
  attempt: number;
}

export class CourseReportResponseDto {
  @ApiProperty({
    description: 'Report data items',
    type: [CourseLevelReportItemDto],
    isArray: true
  })
  data: CourseLevelReportItemDto[] | LessonLevelReportItemDto[];

  @ApiProperty({
    description: 'Total number of elements',
    example: 25,
    type: 'number'
  })
  totalElements: number;

  @ApiProperty({
    description: 'Current offset',
    example: 0,
    type: 'number'
  })
  offset: number;

  @ApiProperty({
    description: 'Current limit',
    example: 10,
    type: 'number'
  })
  limit: number;
} 