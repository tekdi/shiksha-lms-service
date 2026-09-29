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
  categoryId: CATEGORY_ID,
  ...overrides,
});

describe('Course category DTOs', () => {
  it('accepts a course with a category', async () => {
    expect(await errorFields(toDto(CreateCourseDto, baseCourse()))).toEqual([]);
  });

  it('requires categoryId when creating a course', async () => {
    const dto = toDto(CreateCourseDto, baseCourse({ categoryId: undefined }));
    expect(await errorFields(dto)).toEqual(['categoryId']);
  });

  it('accepts a non-UUID string categoryId', async () => {
    const dto = toDto(
      CreateCourseDto,
      baseCourse({ categoryId: 'leadership' }),
    );
    expect(await errorFields(dto)).toEqual([]);
  });

  it('keeps categoryId optional on update and accepts any string', async () => {
    expect(await errorFields(toDto(UpdateCourseDto, {}))).toEqual([]);
    expect(
      await errorFields(toDto(UpdateCourseDto, { categoryId: CATEGORY_ID })),
    ).toEqual([]);
    expect(
      await errorFields(toDto(UpdateCourseDto, { categoryId: 'abc' })),
    ).toEqual([]);
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
    const dto = toDto(SearchCourseDto, { categoryId: value });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toEqual(expected);
  });

  it('leaves the search filter unset when categoryId is not provided', async () => {
    const dto = toDto(SearchCourseDto, {});
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toBeUndefined();
  });

  it('accepts non-UUID string values in the search filter', async () => {
    const dto = toDto(SearchCourseDto, { categoryId: 'leadership,management' });
    expect(await errorFields(dto)).toEqual([]);
    expect(dto.categoryId).toEqual(['leadership', 'management']);
  });
});
