import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModuleStatus } from '../entities/module.entity';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';

/**
 * DTO for creating a new module
 * Note: tenantId and organisationId are handled automatically through the authenticated user's context
 */
export class CreateModuleDto {
  @ApiProperty({ 
    description: 'Module title',
    example: 'Introduction to HTML',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  title: string;

  @ApiProperty({ 
    description: 'Course ID this module belongs to',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  courseId: string;

  @ApiProperty({ description: 'Parent module ID for nested modules', required: false })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  parentId?: string;

  @ApiProperty({ description: 'Module ordering within its level', required: false })
  @IsOptional()
  @IsNumber({}, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_NUMBER })
  ordering?: number;

  @ApiPropertyOptional({ 
    description: 'Module description',
    example: 'Learn about different machine learning algorithms and their practical applications' 
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Module status',
    enum: ModuleStatus,
    example: ModuleStatus.UNPUBLISHED,
    default: ModuleStatus.UNPUBLISHED
  })
  @IsOptional()
  @IsEnum(ModuleStatus, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_STATUS })
  status?: ModuleStatus = ModuleStatus.UNPUBLISHED;

  @ApiPropertyOptional({ 
    description: 'URL to module image',
    example: 'https://example.com/images/module-image.jpg' 
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  image?: string;

  @ApiPropertyOptional({ 
    description: 'Start date and time of the module',
    example: '2024-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  startDatetime?: string;

  @ApiPropertyOptional({ 
    description: 'End date and time of the module',
    example: '2024-12-31T23:59:59Z'
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  endDatetime?: string;

  @ApiPropertyOptional({ 
    description: 'Eligibility criteria for the module',
    example: 'Must have completed Introduction module'
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  eligibilityCriteria?: string;

  @ApiPropertyOptional({ 
    description: 'Badge ID associated with the module',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  badgeId?: string;

  @ApiPropertyOptional({ 
    description: 'Badge terms for the module',
    example: { term: 'completion' }
  })
  @IsOptional()
  @IsObject({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_OBJECT })
  badgeTerm?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Additional parameters for the module (stored as JSONB)'
  })
  @IsOptional()
  @IsObject({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_OBJECT })
  params?: Record<string, any>;
}