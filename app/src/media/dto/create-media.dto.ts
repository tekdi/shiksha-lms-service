import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { RESPONSE_MESSAGES, VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { LessonFormat } from '../../lessons/entities/lesson.entity';
export enum MediaFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'test',
  EVENT = 'event',
}

export class  CreateMediaDto {
  @ApiProperty({
    description: VALIDATION_MESSAGES.MEDIA.TYPE,
    example: 'video',
    required: true,
  })
  @IsEnum(LessonFormat, { message: VALIDATION_MESSAGES.COMMON.ENUM('Format') })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Format') })
  format: LessonFormat;

  @ApiProperty({
    description: 'Media sub-format',
    example: 'video.youtube',
    required: false,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Sub-format') })
  subFormat?: string;

  @ApiProperty({
    description: 'Media path',
    example: '/uploads/media/example.pdf',
    required: false,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Path') })
  path?: string;

  @ApiProperty({
    description: 'Media source (URL, content, etc.)',
    example: 'https://youtube.com/watch?v=example',
    required: false,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Source') })
  source?: string;

  @ApiProperty({
    description: 'Storage type',
    example: 'local',
    required: false,
    default: 'local',
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Storage') })
  storage?: string;

  @ApiProperty({
    description: VALIDATION_MESSAGES.COURSE.PARAMS,
    example: '{"duration": 120, "resolution": "720p"}',
    required: false,
  })
  @IsOptional()
  params?: any;

  @ApiProperty({
    description: 'User who created the media',
    example: 'user-123',
    required: false,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Created by') })
  createdBy?: string;
}
