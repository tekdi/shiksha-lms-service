import { ApiProperty, PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
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
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { LessonFormat, AttemptsGradeMethod } from '../entities/lesson.entity';
import { LessonStatus } from '../entities/lesson.entity';
import { CreateLessonDto } from './create-lesson.dto';

// Inherits all fields from CreateLessonDto as optional, except for format and mediaId which shouldn't be updatable
export class UpdateLessonDto extends PartialType(
  OmitType(CreateLessonDto, ['format', 'mediaContent'] as const)
) {
  @ApiProperty({
    description: 'User ID who checked out the lesson',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  checkedOut?: string;

  @ApiProperty({
    description: 'Lesson title',
    example: 'Introduction to Machine Learning',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  title?: string;

  @ApiProperty({
    description: 'Lesson alias/URL slug',
    example: 'intro-machine-learning',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  alias?: string;

  @ApiProperty({
    description: 'Lesson status',
    example: LessonStatus.PUBLISHED,
    required: false,
    enum: LessonStatus,
  })
  @IsOptional()
  @IsEnum(LessonStatus, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_STATUS })
  status?: LessonStatus;

  @ApiProperty({
    description: 'Lesson description',
    example: 'Learn the basics of machine learning algorithms',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Lesson thumbnail image Path',
    example: '/images/lesson-thumbnail.jpg'
  })
  @IsOptional()
  @IsString({ message: "Image must be a path to an image" })
  @Matches(/\.(jpg|jpeg|png)$/i, { message: 'Image must be in JPG or PNG format' })
  image?: string;

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
  @IsOptional()
  @ValidateIf(o => o.startDatetime != null)
  @IsDateString({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_DATE })
  endDatetime?: string;

  @ApiProperty({
    description: 'Storage type',
    example: 'local',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  storage?: string;

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

  @ApiProperty({
    description: 'User who updated the lesson',
    example: 'user-123',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  updatedBy?: string;
}
