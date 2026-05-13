import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export class RecalculateProgressDto {
  @ApiProperty({
    description: 'Course ID for which to recalculate progress',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Course ID') })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Course ID') })
  courseId: string;

  @ApiPropertyOptional({
    description:
      'When true, enqueue a background job (requires Redis) and return 202 immediately. Recommended for courses with very many enrollments.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  async?: boolean;

  @ApiPropertyOptional({
    description:
      'When async is true: remove any in-flight recalculate jobs for this course from the queue, then enqueue a new job. Use if a prior job is stuck or you need a guaranteed fresh run.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}


