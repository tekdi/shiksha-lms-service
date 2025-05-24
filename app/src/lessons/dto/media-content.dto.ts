import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';

export enum MediaFormat {
  VIDEO = 'video',
  EVENT = 'event',
  TEST = 'test',
  DOCUMENT = 'document',
}

export enum MediaSubFormat {
  VIDEO_YOUTUBE = 'video.youtube',
  EVENT = 'event',
  TEST_QUIZ = 'test.quiz',
  DOCUMENT_PDF = 'document.pdf',
}

export class MediaContentDto {
  @ApiProperty({
    description: 'Media format',
    enum: MediaFormat,
    example: MediaFormat.VIDEO,
    required: true,
  })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsEnum(MediaFormat, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  format: MediaFormat;

  @ApiProperty({
    description: 'Media sub-format',
    enum: MediaSubFormat,
    example: MediaSubFormat.VIDEO_YOUTUBE,
    required: false,
  })
  @IsOptional()
  @IsEnum(MediaSubFormat, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  subFormat?: MediaSubFormat;

  @ApiProperty({
    description: 'Media source (URL, UUID, etc.)',
    example: 'https://youtube.com/watch?v=example',
    required: false,
  })
  @ValidateIf(o => o.format !== MediaFormat.DOCUMENT)
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  source?: string;

  @ApiProperty({
    description: 'Storage type',
    example: 'local',
    required: false,
    default: 'local',
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_STRING })
  storage?: string = 'local';

  @ApiProperty({
    description: 'Media ID (required for document format)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @ValidateIf(o => o.format === MediaFormat.DOCUMENT)
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  mediaId?: string;
} 