import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum CoursePdfTemplateSource {
  COURSE = 'course',
  COURSE_TEMPLATE = 'course_template',
}

export class CourseCertificatePdfDto {
  @ApiProperty({
    description: 'Course to generate the certificate PDF for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  courseId: string;

  @ApiPropertyOptional({
    description:
      'Optional. The certificate owner is always taken from the Authorization token; when sent, it must match the token user.',
    example: '3129',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Where to read the template from: "course" (courses.templateId, default) or "course_template" (course_templates mapping filtered by certificateType).',
    enum: CoursePdfTemplateSource,
    default: CoursePdfTemplateSource.COURSE,
  })
  @IsOptional()
  @IsEnum(CoursePdfTemplateSource)
  templateSource?: CoursePdfTemplateSource;

  @ApiPropertyOptional({
    description:
      'Template type to pick when templateSource is "course_template" (defaults to "certificate").',
    example: 'certificate',
  })
  @IsOptional()
  @IsString()
  certificateType?: string;
}
