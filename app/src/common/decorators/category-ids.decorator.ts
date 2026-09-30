import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';
import { VALIDATION_MESSAGES } from '../constants/response-messages.constant';

/**
 * Required, non-empty list of (externally managed) category IDs for a course/lesson.
 * multipart/form-data sends a single value as a plain string, so it is normalised to an array.
 */
export const IsCategoryIds = (entityName: string) =>
  applyDecorators(
    ApiProperty({
      description: `Category IDs of the ${entityName} (at least one)`,
      example: ['category-1', 'category-2'],
      type: [String],
      required: true,
    }),
    Transform(({ value }: { value: unknown }) =>
      value === undefined || value === null || Array.isArray(value)
        ? value
        : [value],
    ),
    IsArray({ message: VALIDATION_MESSAGES.COMMON.ARRAY('Category IDs') }),
    ArrayNotEmpty({
      message: VALIDATION_MESSAGES.COMMON.REQUIRED('Category IDs'),
    }),
    IsString({
      each: true,
      message: VALIDATION_MESSAGES.COMMON.STRING('Category IDs'),
    }),
    IsNotEmpty({
      each: true,
      message: VALIDATION_MESSAGES.COMMON.REQUIRED('Category IDs'),
    }),
  );
