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

export enum CertificatePdfContext {
  COURSE = 'course',
  MODULE = 'module',
}

export class CourseCertificatePdfDto {
  @ApiProperty({
    description:
      'What the PDF is for: "course" (course certificate) or "module" (module badge)',
    enum: CertificatePdfContext,
    example: CertificatePdfContext.COURSE,
  })
  @IsNotEmpty()
  @IsEnum(CertificatePdfContext, {
    message: 'context must be one of: course, module',
  })
  context: CertificatePdfContext;

  @ApiProperty({
    description:
      'courseId when context is "course", moduleId when context is "module"',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  contextId: string;

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
      'Course context only. Where to read the template from: "course" (courses.templateId, default) or "course_template" (course_templates mapping filtered by certificateType). Module badges always use modules.badgeId.',
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
