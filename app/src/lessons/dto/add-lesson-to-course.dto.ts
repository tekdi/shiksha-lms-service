import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsEnum,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { AttemptsGradeMethod } from '../entities/lesson.entity';
import { CourseLessonStatus } from '../entities/course-lesson.status';

export class AddLessonToCourseDto {
  @ApiProperty({
    description: 'Sequence order of lesson in course/module',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(0, { message: 'Sequence must not be negative' })
  @Type(() => Number)
  sequence?: number;

  @ApiProperty({
    description: 'Lesson ID',
    format: 'uuid',
  })
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  lessonId: string;

  @ApiProperty({
    description: 'Whether the lesson is free',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  freeLesson?: boolean = false;

  @ApiProperty({
    description: 'Whether to consider this lesson for course passing',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  considerForPassing?: boolean = true;

  @ApiProperty({
    description: 'Status',
    example: CourseLessonStatus.PUBLISHED,
    required: false,
    enum: CourseLessonStatus,
    default: CourseLessonStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(CourseLessonStatus, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_STATUS })
  status?: CourseLessonStatus = CourseLessonStatus.PUBLISHED;

  @ApiProperty({
    description: 'Lesson start date and time',
    example: '2024-06-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_DATE })
  startDatetime?: string;

  @ApiProperty({
    description: 'Lesson end date and time',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @ValidateIf(o => o.startDatetime != null)
  @IsDateString({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_DATE })
  endDatetime?: string;

  @ApiProperty({
    description: 'Number of attempts allowed',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(1, { message: 'Number of attempts must be at least 1' })
  @Type(() => Number)
  noOfAttempts?: number;

  @ApiProperty({
    description: 'Grade calculation method',
    example: 'HIGHEST',
    required: false,
    enum: ['FIRST_ATTEMPT', 'LAST_ATTEMPT', 'AVERAGE', 'HIGHEST'],
  })
  @IsOptional()
  @IsEnum(AttemptsGradeMethod, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  attemptsGrade?: AttemptsGradeMethod;

  @ApiProperty({
    description: 'Eligibility criteria',
    example: 'COMPLETE_PREVIOUS',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  eligibilityCriteria?: string;

  @ApiProperty({
    description: 'Ideal completion time (in minutes)',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(1, { message: 'Ideal time must be at least 1 minute' })
  @Type(() => Number)
  idealTime?: number;

  @ApiProperty({
    description: 'Whether lesson can be resumed',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  resume?: boolean;

  @ApiProperty({
    description: 'Total marks',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(0, { message: 'Total marks must not be negative' })
  @Type(() => Number)
  totalMarks?: number;

  @ApiProperty({
    description: 'Passing marks',
    example: 60,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(0, { message: 'Passing marks must not be negative' })
  @Type(() => Number)
  passingMarks?: number;

  @ApiProperty({
    description: 'Additional parameters as JSON',
    example: '{"difficulty": "beginner", "keywords": ["ml", "ai"]}',
    required: false,
  })
  @IsOptional()
  params?: any;
}
