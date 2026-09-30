import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCourseDto } from './create-course.dto';
import { UpdateCourseDto } from './update-course.dto';
import { SearchCourseDto } from './search-course.dto';

const CATEGORY_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const CATEGORY_ID_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

// Mirrors the global ValidationPipe options in main.ts
const toDto = <T>(cls: new () => T, plain: object): T =>
  plainToInstance(cls, plain, { enableImplicitConversion: true });

const errorFields = async (dto: object) =>
  (await validate(dto)).map((e) => e.property);

const baseCourse = (overrides: object = {}) => ({
  title: 'Course',
  description: 'Description',
  categoryIds: [CATEGORY_ID],
  ...overrides,
});

describe('Course category DTOs', () => {
  it('accepts a course with one category', async () => {
    expect(await errorFields(toDto(CreateCourseDto, baseCourse()))).toEqual([]);
  });

  it('accepts a course with multiple categories', async () => {
    const dto = toDto(
      CreateCourseDto,
      baseCourse({ categoryIds: [CATEGORY_ID, CATEGORY_ID_2, 'leadership'] }),
    );
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toEqual([CATEGORY_ID, CATEGORY_ID_2, 'leadership']);
  });

  it('requires categoryIds when creating a course', async () => {
    const dto = toDto(CreateCourseDto, baseCourse({ categoryIds: undefined }));
    expect(await errorFields(dto)).toEqual(['categoryIds']);
  });

  it.each([
    ['an empty array', []],
    ['an empty string element', ['']],
    ['a non-string element', [123]],
  ])('rejects %s', async (_label, categoryIds) => {
    const dto = toDto(CreateCourseDto, baseCourse({ categoryIds }));
    expect(await errorFields(dto)).toEqual(['categoryIds']);
  });

  it('wraps a single multipart value into an array', async () => {
    const dto = toDto(
      CreateCourseDto,
      baseCourse({ categoryIds: 'leadership' }),
    );
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toEqual(['leadership']);
  });

  it('keeps categoryIds optional on update and replaces the whole array', async () => {
    expect(await errorFields(toDto(UpdateCourseDto, {}))).toEqual([]);
    const dto = toDto(UpdateCourseDto, {
      categoryIds: [CATEGORY_ID, CATEGORY_ID_2],
    });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toEqual([CATEGORY_ID, CATEGORY_ID_2]);
    expect(
      await errorFields(toDto(UpdateCourseDto, { categoryIds: [] })),
    ).toEqual(['categoryIds']);
  });

  it.each([
    ['a single value', CATEGORY_ID, [CATEGORY_ID]],
    [
      'comma-separated values',
      `${CATEGORY_ID},${CATEGORY_ID_2}`,
      [CATEGORY_ID, CATEGORY_ID_2],
    ],
    [
      'repeated params',
      [CATEGORY_ID, CATEGORY_ID_2],
      [CATEGORY_ID, CATEGORY_ID_2],
    ],
  ])('parses the search filter from %s', async (_label, value, expected) => {
    const dto = toDto(SearchCourseDto, { categoryIds: value });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toEqual(expected);
  });

  it('leaves the search filter unset when categoryIds is not provided', async () => {
    const dto = toDto(SearchCourseDto, {});
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toBeUndefined();
  });

  it('accepts non-UUID string values in the search filter', async () => {
    const dto = toDto(SearchCourseDto, {
      categoryIds: 'leadership,management',
    });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryIds).toEqual(['leadership', 'management']);
  });
});
