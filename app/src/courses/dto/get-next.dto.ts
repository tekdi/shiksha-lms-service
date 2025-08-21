import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';

export enum NextIdFor {
  COURSE = 'course',
  MODULE = 'module',
  LESSON = 'lesson',
}

export class GetNextDto {
  @ApiProperty({
    description: 'Type of entity to find next for',
    enum: NextIdFor,
    example: NextIdFor.COURSE,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('nextIdFor') })
  @IsEnum(NextIdFor, { message: 'nextIdFor must be one of: course, module, lesson' })
  nextIdFor: NextIdFor;

  @ApiProperty({
    description: 'Current entity ID to find next for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('id') })
  @IsUUID('4', { message: VALIDATION_MESSAGES.COMMON.UUID('id') })
  id: string;
} 