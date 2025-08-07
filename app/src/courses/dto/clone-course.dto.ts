import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

/**
 * DTO for creating a new module
 * Note: tenantId and organisationId are handled automatically through the authenticated user's context
 */
export class CloneCourseDto {
  @ApiProperty({
    description: 'New Cohort ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('New Cohort ID') })
  newCohortId: string;
}
