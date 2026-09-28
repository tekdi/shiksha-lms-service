import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from './create-lesson.dto';
import { UpdateLessonDto } from './update-lesson.dto';
import { LessonFormat, LessonSubFormat } from '../entities/lesson.entity';

const COURSE_ID = '123e4567-e89b-42d3-a456-426614174000';
const MODULE_ID = '987fcdeb-51a2-43c1-b456-426614174000';

// Mirrors the global ValidationPipe options in main.ts
const toDto = <T>(cls: new () => T, plain: object): T =>
  plainToInstance(cls, plain, { enableImplicitConversion: true });

const errorFields = async (dto: object) =>
  (await validate(dto)).map((e) => e.property);

const baseLesson = (overrides: object = {}) => ({
  title: 'Intro',
  format: LessonFormat.VIDEO,
  mediaContentSource: 'https://youtube.com/watch?v=x',
  mediaContentSubFormat: LessonSubFormat.YOUTUBE,
  ...overrides,
});

describe('CreateLessonDto course/module context', () => {
  it('accepts a standard course lesson', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({ courseId: COURSE_ID, moduleId: MODULE_ID }),
    );
    expect(await errorFields(dto)).toEqual([]);
  });

  it('accepts an independent lesson without courseId and moduleId', async () => {
    const dto = toDto(CreateLessonDto, baseLesson());
    expect(await errorFields(dto)).toEqual([]);
  });

  it.each([
    ['empty strings', ''],
    ['"null" strings', 'null'],
  ])('treats multipart %s as independent', async (_label, value) => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({ courseId: value, moduleId: value }),
    );
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.courseId).toBeNull();
    expect(dto.moduleId).toBeNull();
  });

  it('requires moduleId when only courseId is provided', async () => {
    const dto = toDto(CreateLessonDto, baseLesson({ courseId: COURSE_ID }));
    expect(await errorFields(dto)).toEqual(['moduleId']);
  });

  it('requires courseId when only moduleId is provided', async () => {
    const dto = toDto(CreateLessonDto, baseLesson({ moduleId: MODULE_ID }));
    expect(await errorFields(dto)).toEqual(['courseId']);
  });

  it('rejects an invalid courseId', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({ courseId: 'abc', moduleId: MODULE_ID }),
    );
    expect(await errorFields(dto)).toEqual(['courseId']);
  });

  it.each([LessonFormat.ASSESSMENT, LessonFormat.EVENT])(
    'requires courseId and moduleId for %s lessons',
    async (format) => {
      const dto = toDto(
        CreateLessonDto,
        baseLesson({ format, mediaContentSubFormat: LessonSubFormat.QUIZ }),
      );
      expect((await errorFields(dto)).sort()).toEqual(['courseId', 'moduleId']);
    },
  );

  it('accepts an assessment lesson with courseId and moduleId', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({
        format: LessonFormat.ASSESSMENT,
        mediaContentSubFormat: LessonSubFormat.QUIZ,
        courseId: COURSE_ID,
        moduleId: MODULE_ID,
      }),
    );
    expect(await errorFields(dto)).toEqual([]);
  });

  it('allows external.assessment.url sub-format as an independent lesson', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({
        mediaContentSubFormat: LessonSubFormat.EXTERNAL_ASSESSMENT_URL,
      }),
    );
    expect(await errorFields(dto)).toEqual([]);
  });
});

describe('UpdateLessonDto course/module fields', () => {
  it('keeps courseId and moduleId optional', async () => {
    const dto = toDto(UpdateLessonDto, {
      title: 'New title',
      mediaContentSubFormat: LessonSubFormat.YOUTUBE,
    });
    expect(await errorFields(dto)).toEqual([]);
  });
});
