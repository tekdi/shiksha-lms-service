import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { COURSE_LANGUAGES, CourseLanguage } from '../entities/course.entity';

/** POST courses/:courseId/translations: copy the course (sections, lessons, media) as another language version */
export class CreateCourseTranslationDto {
  @ApiProperty({
    description: 'Language of the new version',
    enum: COURSE_LANGUAGES,
    example: 'hi',
  })
  @IsNotEmpty()
  @IsIn(COURSE_LANGUAGES as unknown as string[], {
    message: 'language must be one of: en, hi, mr',
  })
  language: CourseLanguage;

  @ApiPropertyOptional({
    description: 'Title of the new version (default: the source title)',
    example: 'बचत की मूल बातें',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

/**
 * PATCH courses/:courseId/translation-group: make this course a language version of another course
 * (joins that course's group), or with null take it out of its group.
 */
export class LinkCourseTranslationDto {
  @ApiProperty({
    description:
      'Course whose versions this course joins; null takes this course out of its group',
    nullable: true,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ValidateIf((o) => o.versionOfCourseId !== null)
  @IsUUID('all', { message: 'versionOfCourseId must be a UUID or null' })
  versionOfCourseId: string | null;
}

/** One language version as listed by GET courses/:courseId/translations */
export class CourseTranslationItemDto {
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: COURSE_LANGUAGES }) language: CourseLanguage;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true }) sourceCourseId: string | null;
  @ApiProperty() translationGroupId: string;
}
