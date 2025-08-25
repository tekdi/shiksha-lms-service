import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum, IsNumber, IsUUID, IsObject, IsDateString, MinLength, MaxLength, Matches, ValidateIf, Validate, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus, RewardType } from '../entities/course.entity';
import { HelperUtil } from '../../common/utils/helper.util';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export class CreateCourseDto {
  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.TITLE,
    example: 'Introduction to Web Development',
    required: true
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Title') })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Title') })
  @MaxLength(255, { message: VALIDATION_MESSAGES.COMMON.MAX_LENGTH('Title', 255) })
  title: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.ALIAS,
    example: 'intro-web-dev',
  })
  @IsOptional()
  alias: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.START_DATE,
    example: '2024-01-01T00:00:00Z'
  })
  @IsOptional()
  startDatetime: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.END_DATE,
    example: '2024-12-31T23:59:59Z',
    required: true
  })
  @ValidateIf((o) => o.startDatetime)
  @Validate(HelperUtil.validateDatetimeConstraints, {
    message: 'Invalid datetime constraints. Start date must be in the future, end date must follow start date, and duration must be between 1 day and 1 year.'
  })
  endDatetime: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.SHORT_DESCRIPTION,
    example: 'A brief intro to web development'
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Short description') })
  shortDescription: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.COURSE.DESCRIPTION,
    example: 'Learn the fundamentals of web development',
    required: true
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Description') })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Description') })
  description: string;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.IMAGE,
    example: 'https://example.com/images/course-thumbnail.jpg'
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Image') })
  image?: string;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.FEATURED,
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Featured') })
  @Type(() => Boolean)
  featured?: boolean;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.FREE,
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Free') })
  @Type(() => Boolean)
  free?: boolean

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.STATUS,
    enum: CourseStatus,
    example: CourseStatus.UNPUBLISHED,
    default: CourseStatus.UNPUBLISHED
  })
  @IsOptional()
  @IsEnum(CourseStatus, { message: VALIDATION_MESSAGES.COMMON.ENUM('Status') })
  status?: CourseStatus = CourseStatus.UNPUBLISHED;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.ADMIN_APPROVAL,
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Admin approval') })
  @Type(() => Boolean)
  adminApproval?: boolean;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.AUTO_ENROLL,
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Auto enroll') })
  @Type(() => Boolean)
  autoEnroll?: boolean

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.CERTIFICATE_TERM,
    example: { term: 'completion' }
  })
  @IsOptional()
  @IsObject({ message: VALIDATION_MESSAGES.COMMON.OBJECT('Certificate term') })
  certificateTerm?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.REWARD_TYPE,
    enum: RewardType,
    example: RewardType.CERTIFICATE
  })
  @IsOptional()
  @IsEnum(RewardType, { message: VALIDATION_MESSAGES.COMMON.ENUM('Reward type') })
  rewardType?: RewardType;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.TEMPLATE_ID,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Template ID') })
  templateId?: string;

  @ApiPropertyOptional({ 
    description: 'Prerequisites for the course - array of prerequisite course IDs',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43c1-b456-426614174000'],
    type: [String]
  })
  @IsOptional() 
  @IsArray({ message: VALIDATION_MESSAGES.COMMON.ARRAY('Prerequisites') })
  @IsUUID('4', { each: true, message: VALIDATION_MESSAGES.COMMON.UUID('Prerequisite course ID') })
  prerequisites?: string[];

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.PARAMS,
    example: {
      difficulty: 'intermediate',
      prerequisites: ['basic-programming'],
      learningOutcomes: ['outcome1', 'outcome2']
    }
  })
  @IsOptional()
  @IsObject({ message: VALIDATION_MESSAGES.COMMON.OBJECT('Additional parameters') })
  params?: Record<string, any>;
}