import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { TrackingStatus } from '../entities/course-track.entity';

export class UpdateCourseTrackingDto {
  @ApiProperty({
    description: 'Course tracking status',
    enum: TrackingStatus,
    example: TrackingStatus.COMPLETED,
    required: false
  })
  @IsOptional()
  @IsEnum(TrackingStatus, { 
    message: VALIDATION_MESSAGES.COMMON.ENUM('Status') 
  })
  status?: TrackingStatus;

  @ApiProperty({
    description: 'Start datetime of the course',
    example: '2024-01-01T00:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('Start datetime') })
  startDatetime?: string;

  @ApiProperty({
    description: 'End datetime of the course',
    example: '2024-01-31T23:59:59Z',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('End datetime') })
  endDatetime?: string;

  @ApiProperty({
    description: 'Number of lessons in the course',
    example: 10,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Number of lessons') })
  @Min(0, { message: VALIDATION_MESSAGES.COMMON.MIN_VALUE('Number of lessons', 0) })
  @Type(() => Number)
  noOfLessons?: number;

  @ApiProperty({
    description: 'Number of completed lessons',
    example: 8,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: VALIDATION_MESSAGES.COMMON.NUMBER('Completed lessons') })
  @Min(0, { message: VALIDATION_MESSAGES.COMMON.MIN_VALUE('Completed lessons', 0) })
  @Type(() => Number)
  completedLessons?: number;

  @ApiProperty({
    description: 'Last accessed date',
    example: '2024-01-15T10:30:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('Last accessed date') })
  lastAccessedDate?: string;

  @ApiProperty({
    description: 'Certificate generation date',
    example: '2024-01-31T12:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('Certificate generation date') })
  certGenDate?: string;

  @ApiProperty({
    description: 'Certificate issued',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  certificateIssued?: boolean;
}