import { IsNotEmpty, IsString } from 'class-validator';

export class GetTemplateDto {
  @IsNotEmpty()
  @IsString()
  templateId: string;
}