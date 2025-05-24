import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

// Inherits all fields from CreateCourseDto as optional
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}