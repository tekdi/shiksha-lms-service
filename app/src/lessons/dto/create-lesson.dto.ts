import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';
import { LessonStatus } from '../entities/lesson.entity';
import { LessonFormat, AttemptsGradeMethod } from '../entities/lesson.entity';
import { MediaContentDto } from './media-content.dto';

export class CreateLessonDto {
  @ApiProperty({
    description: 'Lesson title',
    example: 'Introduction to HTML Tags',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  title: string;

  @ApiProperty({
    description: 'Lesson alias/slug',
    example: 'intro-html-tags',
    required: true
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  alias?: string;

  @ApiProperty({
    description: 'Lesson format',
    enum: LessonFormat,
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsEnum(LessonFormat, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  format: LessonFormat;

  @ApiProperty({
    description: 'Media content details',
    type: MediaContentDto,
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @ValidateNested()
  @Type(() => MediaContentDto)
  mediaContent: MediaContentDto;

  @ApiPropertyOptional({ 
    description: 'Lesson thumbnail image Path',
    example: '/images/course-thumbnail.jpg'
  })
  @IsOptional()
  @IsString({ message: "Image must be a path to an image" })
  @Matches(/\.(jpg|jpeg|png)$/i, { message: 'Image must be in JPG or PNG format' })
  image?: string;
  // @ApiProperty({
  //   description: 'Media ID (for document format)',
  //   required: false
  // })
  // @IsOptional()
  // @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  // mediaId?: string;

  @ApiProperty({
    description: 'Tenant ID',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  tenantId?: string;

  @ApiProperty({
    description: 'User ID who checked out the lesson',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  checkedOut?: string;

  @ApiProperty({
    description: 'Lesson status',
    example: LessonStatus.PUBLISHED,
    required: false,
    enum: LessonStatus,
    default: LessonStatus.PUBLISHED
  })
  @IsOptional()
  @IsEnum(LessonStatus, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_STATUS })
  status?: LessonStatus = LessonStatus.PUBLISHED;

  @ApiProperty({
    description: 'Lesson description',
    example: 'Learn the basics of HTML tags and their usage',
    required: true
  })
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  description?: string;

  @ApiProperty({
    description: 'Lesson start date and time',
    example: '2024-06-01T00:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_DATE })
  startDatetime?: string;

  @ApiProperty({
    description: 'Lesson end date and time',
    example: '2024-12-31T23:59:59Z',
    required: false
  })
  @IsOptional()
  @ValidateIf(o => o.startDatetime != null)
  @IsDateString({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_DATE })
  endDatetime?: string;

  @ApiProperty({
    description: 'Storage type',
    example: 'local',
    required: false
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  storage?: string;

  @ApiProperty({
    description: 'Number of attempts allowed',
    example: 3,
    required: false,
    default: 1
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(1, { message: 'Number of attempts must be at least 1' })
  @Type(() => Number)
  noOfAttempts?: number = 1;

  @ApiProperty({
    description: 'Grade calculation method',
    example: AttemptsGradeMethod.HIGHEST,
    required: false,
    enum: AttemptsGradeMethod,
    default: AttemptsGradeMethod.HIGHEST
  })
  @IsOptional()
  @IsEnum(AttemptsGradeMethod, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  attemptsGrade?: AttemptsGradeMethod = AttemptsGradeMethod.HIGHEST;

  @ApiProperty({
    description: 'Eligibility criteria',
    example: 'COMPLETE_PREVIOUS',
    required: false
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  eligibilityCriteria?: string;

  @ApiProperty({
    description: 'Ideal completion time (in minutes)',
    example: 30,
    required: false
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(1, { message: 'Ideal time must be at least 1 minute' })
  @Type(() => Number)
  idealTime?: number;

  @ApiProperty({
    description: 'Whether lesson can be resumed',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  resume?: boolean;

  @ApiProperty({
    description: 'Total marks',
    example: 100,
    required: false
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(0, { message: 'Total marks must not be negative' })
  @Type(() => Number)
  totalMarks?: number;

  @ApiProperty({
    description: 'Passing marks',
    example: 60,
    required: false
  })
  @IsOptional()
  @IsInt({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  @Min(0, { message: 'Passing marks must not be negative' })
  @Type(() => Number)
  passingMarks?: number;

  @ApiProperty({
    description: 'Additional parameters as JSON',
    example: { difficulty: 'beginner', keywords: ['html', 'tags'] },
    required: false
  })
  @IsOptional()
  params?: Record<string, any>;

  /* Course Association Fields */
  
  @ApiProperty({
    description: 'Course ID to associate the lesson with',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  courseId?: string;

  @ApiProperty({
    description: 'Module ID to associate the lesson with',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  moduleId?: string;

  @ApiProperty({
    description: 'Whether this is a free lesson',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  freeLesson?: boolean = false;

  @ApiProperty({
    description: 'Whether to consider this lesson for passing the course',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_BOOLEAN })
  @Type(() => Boolean)
  considerForPassing?: boolean = true;
}
