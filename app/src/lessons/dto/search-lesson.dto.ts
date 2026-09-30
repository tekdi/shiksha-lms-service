import { ParseUUIDPipe } from "@nestjs/common/pipes/parse-uuid.pipe"
import { LessonFormat, LessonStatus } from "../entities/lesson.entity"
import { LessonSubFormat } from "../entities/lesson.entity"
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional } from "class-validator";
import { IsString } from "class-validator";
import { Transform } from "class-transformer";
import { HelperUtil } from "../../common/utils/helper.util";


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

@ApiPropertyOptional({
  description: 'Filter by one or more category IDs (comma-separated or repeated). Returns lessons in any of the given categories.',
  type: [String],
  example: '123,456',
})
@IsOptional()
@Transform(({ obj, key }) => HelperUtil.toStringArray(obj[key]))
@IsArray()
@IsString({ each: true, message: 'Each category ID must be a string' })
categoryIds?: string[];

}
