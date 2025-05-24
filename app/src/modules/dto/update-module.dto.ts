import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsDate, IsEnum, IsNumber, IsUUID, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';
import { ModuleStatus } from '../entities/module.entity';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';

// Inherits all fields from CreateModuleDto as optional, but omits courseId since it shouldn't be updatable
export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, ['courseId'] as const)
) {}