import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { TrackingStatus } from '../entities/course-track.entity';

export class UpdateEventProgressDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('User ID') })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('User ID') })
  userId: string;

  @ApiProperty({ 
    description: 'Status of the lesson attempt',
    example: 'completed',
    enum: TrackingStatus,
    required: false
  })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Status') })
  @IsOptional()
  status?: TrackingStatus;

  @ApiProperty({ 
    description: 'Time spent in seconds',
    example: 300,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Time spent') })
  @Min(0, { message: VALIDATION_MESSAGES.COMMON.POSITIVE('Time spent') })
  @Type(() => Number)
  timeSpent?: number;
}