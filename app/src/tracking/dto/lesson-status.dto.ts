import { ApiProperty } from '@nestjs/swagger';

export class LessonStatusDto {
  @ApiProperty({
    description: 'Whether the lesson can be resumed',
    example: true
  })
  canResume: boolean;

  @ApiProperty({
    description: 'Whether the lesson can be reattempted',
    example: false
  })
  canReattempt: boolean;

  @ApiProperty({
    description: 'Status of the last attempt',
    example: 'in-progress',
    enum: ['not-started', 'in-progress', 'completed']
  })
  lastAttemptStatus: string;

  @ApiProperty({
    description: 'ID of the last attempt',
    example: 'attempt_abc123',
    nullable: true
  })
  lastAttemptId: string | null;

  @ApiProperty({
    description: 'Whether the lesson is eligible to be started',
    example: true
  })
  isEligible: boolean;

  @ApiProperty({
    description: 'Required lessons for the lesson',
    example: ['lesson_123', 'lesson_456']
  })
  requiredLessons: any[];
} 