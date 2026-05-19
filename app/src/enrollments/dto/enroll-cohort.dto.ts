import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export class EnrollCohortDto {
  @ApiProperty({
    description: 'Learner ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Learner ID') })
  learnerId: string;

  @ApiProperty({
    description: 'Cohort ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsString({ message: 'Cohort ID must be a string' })
  cohortId: string;
}
