import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class EditTemplateDto {
  @IsNotEmpty()
  @IsString()
  templateId: string;

  @IsNotEmpty()
  @IsString()
  template: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['certificate', 'badge','acknowledgement', 'paid_certificate', 'paid_acknowledgement'])
  type: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['certificate', 'badge','acknowledgement', 'paid_certificate', 'paid_acknowledgement'])
  template_type?: string;
}