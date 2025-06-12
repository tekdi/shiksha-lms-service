import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMimeType, IsOptional, IsString } from 'class-validator';

export enum UploadType {
  COURSE = 'course',
  MODULE = 'module',
  LESSON = 'lesson',
  LESSON_MEDIA = 'lessonMedia',
  LESSON_ASSOCIATED_MEDIA = 'lessonAssociatedMedia',
}

export class GetPresignedUrlDto {
  @ApiProperty({
    description: 'Type of upload (course, module, lesson, lessonMedia, lessonAssociatedMedia)',
  })
  @IsEnum(UploadType)
  type: UploadType;

  @ApiProperty({
    description: 'MIME type of the file to upload',
    example: 'image/jpeg',
  })
  @IsMimeType()
  mimeType: string;

  @ApiProperty({
    description: 'Optional custom file name',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileName?: string;
} 