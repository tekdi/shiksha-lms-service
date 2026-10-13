import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetTemplatesDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['certificate', 'badge', 'acknowledgement', 'paid_certificate', 'paid_acknowledgement'], {
    message: 'templateType must be one of: certificate, badge, acknowledgement, paid_certificate, paid_acknowledgement'
  })
  templateType?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  contextId?: string;

  /** When false, only templates with no course_templates row. When true, only templates assigned to at least one course. Omit for all templates. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAllocated?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}