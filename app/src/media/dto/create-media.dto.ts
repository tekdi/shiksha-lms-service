import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { RESPONSE_MESSAGES } from '../../common/constants/response-messages.constant';

export enum MediaFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'test',
  EVENT = 'event',
}

export class CreateMediaDto {
  @ApiProperty({
    description: 'Media format',
    example: 'video',
    required: true,
  })
  @IsEnum(MediaFormat, { message: RESPONSE_MESSAGES.VALIDATION.INVALID_ENUM })
  @IsNotEmpty({ message: RESPONSE_MESSAGES.VALIDATION.REQUIRED_FIELD })
  format: MediaFormat;

  @ApiProperty({
    description: 'Media sub-format',
    example: 'video.youtube',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  subFormat?: string;

 
  @ApiProperty({
    description: 'Media path',
    example: '/uploads/media/example.pdf',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  path?: string;

  @ApiProperty({
    description: 'Media source (URL, content, etc.)',
    example: 'https://youtube.com/watch?v=example',
    required: false,
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  source?: string;

  @ApiProperty({
    description: 'Storage type',
    example: 'local',
    required: false,
    default: 'local',
  })
  @IsOptional()
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  storage?: string;

  @ApiProperty({
    description: 'Additional parameters as JSON',
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
  @IsString({ message: RESPONSE_MESSAGES.VALIDATION.INVALID_FORMAT })
  createdBy?: string;
}
