import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CourseHierarchyFilterDto {
  @ApiProperty({
    description: 'Include modules in the response (default: true)',
    required: false,
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeModules?: boolean = false;

  @ApiProperty({
    description: 'Include lessons in the response (default: false)',
    required: false,
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  includeLessons?: boolean = false;

  @ApiProperty({
    description: 'Module ID to filter lessons for a specific module (required when includeLessons=true)',
    format: 'uuid',
    required: false,
    example: 'fd127860-5efa-4b4b-b8ae-d855fc71158f'
  })
  @IsOptional()
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  moduleId?: string;
}