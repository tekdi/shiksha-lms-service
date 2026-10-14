import { IsNotEmpty, IsString, IsArray, ArrayMinSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class AddCourseTemplateDto {
  @IsNotEmpty()
  @Transform(({ value }) => {
    // Convert single string to array for consistent processing
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one templateId is required' })
  @IsString({ each: true })
  templateId: string[];

  @IsNotEmpty()
  @Transform(({ value }) => {
    // Convert single string to array for consistent processing
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one contextId is required' })
  @IsString({ each: true })
  contextId: string[];
}