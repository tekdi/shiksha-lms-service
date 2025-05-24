import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';
import { RESPONSE_MESSAGES } from '../constants/response-messages.constant';

export class CommonQueryDto {
  @ApiProperty({
    description: 'User ID',
    format: 'uuid',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  userId: string;

  @ApiProperty({
    description: 'Tenant ID',
    format: 'uuid',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  tenantId: string;

  @ApiProperty({
    description: 'Organisation ID',
    format: 'uuid',
    required: true
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID('4', { message: RESPONSE_MESSAGES.VALIDATION.INVALID_UUID })
  organisationId: string;
} 