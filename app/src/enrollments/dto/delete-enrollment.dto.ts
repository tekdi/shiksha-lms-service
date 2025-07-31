import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class DeleteEnrollmentDto {
  @ApiProperty({
    description: 'Course ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    format: 'uuid'
  })
  @IsUUID()
  @IsNotEmpty()
  courseId: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    format: 'uuid'
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
} 