import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLessonDto } from './create-lesson.dto';
import { UpdateLessonDto } from './update-lesson.dto';
import { SearchLessonDto } from './search-lesson.dto';
import { LessonFormat, LessonSubFormat } from '../entities/lesson.entity';

const COURSE_ID = '123e4567-e89b-42d3-a456-426614174000';
const MODULE_ID = '987fcdeb-51a2-43c1-b456-426614174000';
const CATEGORY_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CATEGORY_ID_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

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
  categoryId: CATEGORY_ID,
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

describe('Lesson category', () => {
  it('requires categoryId when creating a lesson', async () => {
    const dto = toDto(CreateLessonDto, baseLesson({ categoryId: undefined }));
    expect(await errorFields(dto)).toEqual(['categoryId']);
  });

  it('requires categoryId for an independent lesson too', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({ categoryId: '', courseId: '', moduleId: '' }),
    );
    expect(await errorFields(dto)).toEqual(['categoryId']);
  });

  it('accepts a non-UUID string categoryId', async () => {
    const dto = toDto(
      CreateLessonDto,
      baseLesson({ categoryId: 'leadership' }),
    );
    expect(await errorFields(dto)).toEqual([]);
  });

  it('keeps categoryId optional on update and accepts any string', async () => {
    expect(
      await errorFields(toDto(UpdateLessonDto, { categoryId: CATEGORY_ID })),
    ).toEqual([]);
    expect(
      await errorFields(toDto(UpdateLessonDto, { categoryId: 'abc' })),
    ).toEqual([]);
  });

  it.each([
    ['a single value', CATEGORY_ID, [CATEGORY_ID]],
    [
      'comma-separated values',
      `${CATEGORY_ID}, ${CATEGORY_ID_2}`,
      [CATEGORY_ID, CATEGORY_ID_2],
    ],
    [
      'repeated params',
      [CATEGORY_ID, CATEGORY_ID_2],
      [CATEGORY_ID, CATEGORY_ID_2],
    ],
  ])('parses the list filter from %s', async (_label, value, expected) => {
    const dto = toDto(SearchLessonDto, { categoryId: value });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toEqual(expected);
  });

  it('leaves the list filter unset when categoryId is not provided', async () => {
    const dto = toDto(SearchLessonDto, {});
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toBeUndefined();
  });

  it('accepts non-UUID string values in the list filter', async () => {
    const dto = toDto(SearchLessonDto, { categoryId: 'leadership,management' });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toEqual(['leadership', 'management']);
  });
});
