import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { MediaFormat } from 'src/media/entities/media.entity';
import { LessonFormat } from '../entities/lesson.entity';


export enum MediaSubFormat {
  YOUTUBE = 'youtube.url',
  PDF = 'pdf',
  QUIZ = 'quiz',
  EVENT = 'event',
  VIDEO = 'video.url',
}

export class MediaContentDto {
  @ApiProperty({
    description: VALIDATION_MESSAGES.MEDIA.TYPE,
    enum: MediaFormat,
    example: MediaFormat.VIDEO,
    required: true,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Format') })
  @IsEnum(MediaFormat, { message: VALIDATION_MESSAGES.COMMON.ENUM('Format') })
  format: LessonFormat;

  @ApiProperty({
    description: 'Media sub-format',
    enum: MediaSubFormat,
    example: MediaSubFormat.YOUTUBE,
    required: false,
  })
  @IsOptional()
  @IsEnum(MediaSubFormat, { message: VALIDATION_MESSAGES.COMMON.ENUM('Sub-format') })
  subFormat?: MediaSubFormat;

  @ApiProperty({
    description: VALIDATION_MESSAGES.MEDIA.URL,
    example: 'https://www.youtube.com/watch?v=example',
    required: false,
  })
  @ValidateIf(o => o.format !== MediaFormat.DOCUMENT)
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Source') })
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
  storage?: string = 'local';

  @ApiProperty({
    description: 'Media ID (required for document format)',
    format: 'uuid',
    required: false,
  })
  @ValidateIf(o => o.format === MediaFormat.DOCUMENT)
  @IsOptional()
  @IsUUID('4')
  mediaId?: string;
} 