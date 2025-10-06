import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray, ValidateNested, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LessonFormat, LessonSubFormat } from '../../lessons/entities/lesson.entity';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export class LessonCompletionCriteriaDto {
  @ApiProperty({
    description: 'Lesson format to filter by',
    example: 'video',
    enum: LessonFormat,
    type: 'string'
  })
  @IsEnum(LessonFormat)
  lessonFormat: LessonFormat;

  @ApiProperty({
    description: 'Lesson sub-format to filter by',
    example: 'youtube.url',
    enum: LessonSubFormat,
    type: 'string'
  })
  @IsEnum(LessonSubFormat)
  lessonSubFormat: LessonSubFormat;

  @ApiProperty({
    description: 'Minimum number of completed lessons required (0, 1, 2, 3, etc.)',
    example: 2,
    type: 'number',
    minimum: 0
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completionRule: number;
}

export class LessonCompletionStatusDto {
  @ApiProperty({
    description: 'Cohort ID stored in course.params.cohortId to check lesson completion status for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid'
  })
  @IsUUID()
  cohortId: string;

  @ApiProperty({
    description: 'User ID to check lesson completion status for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid'
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('User ID') })
  userId: string;

  @ApiProperty({
    description: 'Array of criteria to check lesson completion against',
    type: [LessonCompletionCriteriaDto],
    isArray: true,
    example: [
      {
        lessonFormat: 'video',
        lessonSubFormat: 'youtube.url',
        completionRule: 2
      },
      {
        lessonFormat: 'assessment',
        lessonSubFormat: 'quiz',
        completionRule: 1
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonCompletionCriteriaDto)
  criteria: LessonCompletionCriteriaDto[];
}

export class LessonCompletionStatusResponseDto {
  @ApiProperty({
    description: 'Overall completion status based on all criteria',
    example: true,
    type: 'boolean'
  })
  overallStatus: boolean;

  @ApiProperty({
    description: 'Detailed status for each criterion',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        criterion: {
          type: 'object',
          properties: {
            lessonFormat: { type: 'string' },
            lessonSubFormat: { type: 'string' },
            completionRule: { type: 'number' }
          }
        },
        status: { type: 'boolean' },
        totalLessons: { type: 'number' },
        completedLessons: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  criteriaResults: Array<{
    criterion: LessonCompletionCriteriaDto;
    status: boolean;
    totalLessons: number;
    completedLessons: number;
    message: string;
  }>;
}