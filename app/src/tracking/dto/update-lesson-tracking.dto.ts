import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsBoolean, IsObject, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { TrackingStatus } from '../entities/course-track.entity';

export class UpdateLessonTrackingDto {
  @ApiProperty({
    description: 'Lesson ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('Lesson ID') })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Lesson ID') })
  lessonId: string;

  @ApiProperty({ 
    description: 'Total content length',
    example: 100,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Total content length') })
  totalContent?: number;

  @ApiProperty({ 
    description: 'Current position in the lesson',
    example: 50,
    required: false
  })
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Current position') })
  @IsOptional()
  currentPosition?: number;

  @ApiProperty({ 
    description: 'Score',
    example: 50,
    required: false
  })
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Score') })
  @IsOptional()
  score?: number;


  @ApiProperty({ 
    description: 'Status',
    example: 'completed',
    required: false
  })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Status') })
  @IsOptional()
  status?: TrackingStatus;

  @ApiProperty({ 
    description: 'Time spent in seconds since last update',
    example: 300,
    required: false
  })
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Time spent') })
  @Min(0, { message: VALIDATION_MESSAGES.COMMON.POSITIVE('Time spent') })
  @IsOptional()
  @Type(() => Number)
  timeSpent?: number;

}