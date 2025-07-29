import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsUUID, IsObject, MaxLength, MinLength, Validate, ValidateIf, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleStatus } from '../entities/module.entity';
import { HelperUtil } from '../../common/utils/helper.util';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

/**
 * DTO for creating a new module
 * Note: tenantId and organisationId are handled automatically through the authenticated user's context
 */
export class CreateModuleDto {
  @ApiProperty({ 
    description: VALIDATION_MESSAGES.MODULE.TITLE,
    example: 'Introduction to HTML',
    required: true
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Title') })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Title') })
  @MaxLength(255, { message: VALIDATION_MESSAGES.COMMON.MAX_LENGTH('Title', 255) })
  title: string;

  @ApiProperty({ 
    description: 'Module alias/slug',
    example: 'intro-html',
    required: false
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Alias') })
  alias?: string;

  @ApiProperty({ 
    description: VALIDATION_MESSAGES.MODULE.COURSE_ID,
    required: true
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Course ID') })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Course ID') })
  courseId: string;

  @ApiProperty({ description: 'Parent module ID for nested modules', required: false })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Parent ID') })
  parentId?: string;

  @ApiProperty({ description: VALIDATION_MESSAGES.MODULE.ORDER, required: false })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Ordering') })
  ordering?: number;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.MODULE.DESCRIPTION,
    example: 'Learn about different machine learning algorithms and their practical applications' 
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Description') })  
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Module status',
    enum: ModuleStatus,
    example: ModuleStatus.UNPUBLISHED,
    default: ModuleStatus.UNPUBLISHED
  })
  @IsOptional()
  @IsEnum(ModuleStatus, { message: VALIDATION_MESSAGES.COMMON.ENUM('Status') })
  status?: ModuleStatus = ModuleStatus.UNPUBLISHED;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.IMAGE,
    example: 'https://example.com/images/module-image.jpg' 
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Image') })
  image?: string;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.START_DATE,
    example: '2024-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('Start date') })
  startDatetime?: string;

  @ApiPropertyOptional({ 
    description: VALIDATION_MESSAGES.COURSE.END_DATE,
    example: '2024-12-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('End date') })
  @ValidateIf((o) => o.startDatetime)
  @Validate(HelperUtil.validateDatetimeConstraints, {
    message: VALIDATION_MESSAGES.COMMON.DATETIME_CONSTRAINTS
  })
  endDatetime?: string;

  @ApiPropertyOptional({ 
    description: 'Prerequisites for the module - array of prerequisite module IDs',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43c1-b456-426614174000'],
    type: [String],
    isArray: true
  })
  @IsOptional()
  @IsArray({ message: VALIDATION_MESSAGES.COMMON.ARRAY('Prerequisites') })
  @IsUUID('4', { each: true, message: VALIDATION_MESSAGES.COMMON.UUID('Prerequisite module ID') })
  prerequisites?: string[];

  @ApiPropertyOptional({ 
    description: 'Badge ID associated with the module',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Badge ID') })
  badgeId?: string;

  @ApiPropertyOptional({ 
    description: 'Badge terms for the module',
    example: { term: 'completion' }
  })
  @IsOptional()
  @IsObject({ message: VALIDATION_MESSAGES.COMMON.OBJECT('Badge term') })
  badgeTerm?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Additional parameters for the module (stored as JSONB)'
  })
  @IsOptional()
  @IsObject({ message: VALIDATION_MESSAGES.COMMON.OBJECT('Additional parameters') })
  params?: Record<string, any>;
}