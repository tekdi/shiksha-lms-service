import { ParseUUIDPipe } from "@nestjs/common/pipes/parse-uuid.pipe"
import { LessonFormat, LessonStatus } from "../entities/lesson.entity"
import { LessonSubFormat } from "../entities/lesson.entity"
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { IsString } from "class-validator";


export class SearchLessonDto {

@ApiPropertyOptional({ description: 'Filter by cohort ID' })
@IsOptional()
@IsString()
cohortId?: string;

@ApiPropertyOptional({ description: 'Filter by status' })
@IsOptional()
@IsEnum(LessonStatus)
status?: LessonStatus;

@ApiPropertyOptional({ description: 'Filter by format' })
@IsOptional()
@IsEnum(LessonFormat)
format?: LessonFormat;

@ApiPropertyOptional({ description: 'Filter by sub-format' })
@IsOptional()
@IsEnum(LessonSubFormat)
subFormat?: LessonSubFormat;


@ApiPropertyOptional({ description: 'Filter by query' })
@IsOptional()
@IsString()
query?: string;

@ApiPropertyOptional({ description: 'Filter by course ID' })
@IsOptional()
@IsString()
courseId?: string;

@ApiPropertyOptional({ description: 'Filter by module ID' })
@IsOptional()
@IsString()
moduleId?: string;

}
