import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TrackingStatus } from '../../tracking/entities/course-track.entity';

export class UpdateTestProgressDto {
  @ApiProperty({
    description: 'Test ID that maps to media.source column',
    example: 'test-123',
    required: true,
  })
  @IsNotEmpty({ message: 'Test ID is required' })
  @IsString({ message: 'Test ID must be a string' })
  testId: string;

  @ApiProperty({
    description: 'User ID for whom the test progress is being updated',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId: string;

  @ApiProperty({
    description: 'Test score achieved',
    example: 85,
    required: true,
  })
  @IsNotEmpty({ message: 'Score is required' })
  @IsNumber({}, { message: 'Score must be a number' })
  score: number;

  @ApiProperty({
    description: 'Test result (pass/fail)',
    example: 'pass',
    required: true,
  })
  @IsNotEmpty({ message: 'Result is required' })
  @IsString({ message: 'Result must be a string' })
  result: string;

  @ApiProperty({
    description: 'ID of the user who reviewed/graded the test',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty({ message: 'Reviewed by is required' })
  @IsUUID('4', { message: 'Reviewed by must be a valid UUID' })
  reviewedBy: string;
}
