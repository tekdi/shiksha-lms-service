import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum, IsNumber, IsUUID, IsObject, IsDateString, MinLength, MaxLength, Matches, ValidateIf, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus } from '../entities/course.entity';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';

// Custom validator for datetime constraints
function validateDatetimeConstraints(value: string, args: any) {
  const startDate = new Date(args.object.startDatetime);
  const endDate = new Date(value);
  const now = new Date();

  // Check if start date is in the future
  if (startDate <= now) {
    return false;
  }

  // Check if end date follows start date
  if (endDate <= startDate) {
    return false;
  }

  // Check minimum duration (1 day)
  const minDuration = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  if (endDate.getTime() - startDate.getTime() < minDuration) {
    return false;
  }

  // Check maximum duration (1 year)
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (endDate.getTime() - startDate.getTime() > maxDuration) {
    return false;
  }

  return true;
}

export class CreateCourseDto {
  @ApiProperty({ 
    description: 'Course title',
    example: 'Introduction to Web Development',
    required: true
  })
  @IsNotEmpty({ message: "Title is required field" })
  @IsString({ message: "Title must be a string" })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @ApiProperty({ 
    description: 'Course alias/slug',
    example: 'intro-web-dev',
  })
  @IsOptional()
  alias: string;

  @ApiProperty({ 
    description: 'Course start date and time',
    example: '2024-01-01T00:00:00Z',
    required: true
  })
  @IsNotEmpty({ message: "Start date is required field" })
  @IsDateString({}, { message: "Start date must be a valid date" })
  startDatetime: string;

  @ApiProperty({ 
    description: 'Course end date and time',
    example: '2024-12-31T23:59:59Z',
    required: true
  })
  @IsNotEmpty({ message: "End date is required field" })
  @IsDateString({}, { message: "End date must be a valid date" })
  @ValidateIf((o) => o.startDatetime)
  @Validate(validateDatetimeConstraints, {
    message: 'Invalid datetime constraints. Start date must be in the future, end date must follow start date, and duration must be between 1 day and 1 year.'
  })
  endDatetime: string;

  @ApiProperty({ 
    description: 'Short description of the course',
    example: 'A brief intro to web development',
    required: true
  })
  @IsNotEmpty({ message: "Short description is required field" })
  @IsString({ message: "Short description must be a string" })
  @MinLength(3, { message: 'Short description must be at least 3 characters long' })
  @MaxLength(255, { message: 'Short description cannot exceed 255 characters' })
  shortDescription: string;

  @ApiProperty({ 
    description: 'Detailed description of the course',
    example: 'Learn the fundamentals of web development',
    required: true
  })
  @IsNotEmpty({ message: "Description is required field" })
  @IsString({ message: "Description must be a string" })
  @MinLength(1, { message: 'Description must not be empty' })
  @MaxLength(10000, { message: 'Description cannot exceed 10000 characters' })
  description: string;

  @ApiPropertyOptional({ 
    description: 'Course thumbnail image URL',
    example: 'https://example.com/images/course-thumbnail.jpg'
  })
  @IsOptional()
  @IsString({ message: "Image must be a path to an image" })
  @Matches(/\.(jpg|jpeg|png)$/i, { message: 'Image must be in JPG or PNG format' })
  image?: string;

  @ApiPropertyOptional({ 
    description: 'Whether this is a featured course',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: "Featured must be a boolean" })
  @Type(() => Boolean)
  featured?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Whether this is a free course',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: "Free must be a boolean" })
  @Type(() => Boolean)
  free?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Course status',
    enum: CourseStatus,
    example: CourseStatus.UNPUBLISHED,
    default: CourseStatus.UNPUBLISHED
  })
  @IsOptional()
  @IsEnum(CourseStatus, { message: "Status must be a valid course status" })
  status?: CourseStatus = CourseStatus.UNPUBLISHED;

  @ApiPropertyOptional({ 
    description: 'Whether admin approval is required for enrollment',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: "Admin approval must be a boolean" })
  @Type(() => Boolean)
  adminApproval?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Whether users are automatically enrolled',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: "Auto enroll must be a boolean" })
  @Type(() => Boolean)
  autoEnroll?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Certificate term configuration',
    example: { term: 'completion' }
  })
  @IsOptional()
  @IsObject({ message: "Certificate term must be an JSON" })
  certificateTerm?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Certificate ID',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID('4', { message: "Certificate ID must be a valid UUID" })
  certificateId?: string;

  @ApiPropertyOptional({ 
    description: 'Additional parameters for the course (stored as JSONB)',
    example: {
      difficulty: 'intermediate',
      prerequisites: ['basic-programming'],
      learningOutcomes: ['outcome1', 'outcome2']
    }
  })
  @IsOptional()
  @IsObject({ message: "Additional parameters must be an JSON" })
  params?: Record<string, any>;
}