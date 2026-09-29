import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
// Load the lesson entity first to resolve the entity import cycle the same way the app does
import '../lessons/entities/lesson.entity';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseStatus } from './entities/course.entity';
import { VALIDATION_MESSAGES } from '../common/constants/response-messages.constant';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';
const CATEGORY_ID = 'category-1';

describe('CoursesService - category', () => {
  let service: CoursesService;
  let courseRepository: any;
  let cacheService: any;

  beforeEach(() => {
    courseRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      merge: jest.fn((entity, data) => ({ ...entity, ...data })),
      save: jest.fn(async (data) => ({ courseId: 'course-1', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      setCourse: jest.fn(),
      invalidateCourse: jest.fn(),
      invalidateCourseEnrollments: jest.fn(),
      invalidateCourseHierarchyCache: jest.fn(),
      invalidateCourseMetaCache: jest.fn(),
    };
    const cacheConfig = {
      getCourseSearchKey: jest.fn(() => 'course-search'),
      COURSE_TTL: 60,
    };
    const orderingService = {
      getNextCourseOrder: jest.fn().mockResolvedValue(1),
    };

    service = new CoursesService(
      courseRepository,
      {} as any, // moduleRepository
      {} as any, // lessonRepository
      {} as any, // courseTrackRepository
      {} as any, // lessonTrackRepository
      {} as any, // moduleTrackRepository
      {} as any, // mediaRepository
      {} as any, // associatedFileRepository
      {} as any, // userEnrollmentRepository
      cacheService,
      cacheConfig as any,
      {} as any, // modulesService
      orderingService as any,
      {} as any, // configService
    );
  });

  const createDto = (overrides: Partial<CreateCourseDto> = {}) =>
    ({
      title: 'Course',
      alias: 'course',
      description: 'Description',
      categoryId: CATEGORY_ID,
      ...overrides,
    }) as CreateCourseDto;

  describe('create', () => {
    it('creates a course with its category', async () => {
      const course = await service.create(createDto(), USER, TENANT, ORG);

      expect(course).toMatchObject({
        categoryId: CATEGORY_ID,
        title: 'Course',
        tenantId: TENANT,
        organisationId: ORG,
      });
    });
  });

  describe('update', () => {
    const existing = {
      courseId: 'course-1',
      title: 'Course',
      alias: 'course',
      description: 'Description',
      categoryId: CATEGORY_ID,
      tenantId: TENANT,
      organisationId: ORG,
    };

    beforeEach(() => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ ...existing } as any);
    });

    it('changes only the category', async () => {
      const course = await service.update(
        'course-1',
        { categoryId: 'category-2' },
        USER,
        TENANT,
        ORG,
      );

      expect(course).toMatchObject({
        ...existing,
        categoryId: 'category-2',
        updatedBy: USER,
      });
    });

    it.each([null, ''])(
      'rejects removing the category (%p)',
      async (categoryId) => {
        await expect(
          service.update('course-1', { categoryId }, USER, TENANT, ORG),
        ).rejects.toThrow(
          new BadRequestException(
            VALIDATION_MESSAGES.COMMON.REQUIRED('Category ID'),
          ),
        );
        expect(courseRepository.save).not.toHaveBeenCalled();
      },
    );

    it('keeps the category when it is not part of the update', async () => {
      await service.update(
        'course-1',
        { description: 'New' },
        USER,
        TENANT,
        ORG,
      );

      expect(courseRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID }),
      );
    });
  });

  describe('search category filter', () => {
    const searchWhere = () =>
      courseRepository.findAndCount.mock.calls[0][0].where;

    it.each([
      ['one category', [CATEGORY_ID]],
      ['multiple categories', [CATEGORY_ID, 'category-2', 'category-3']],
    ])('filters by %s', async (_label, categoryIds) => {
      await service.search({ categoryId: categoryIds }, TENANT, ORG);

      const where = searchWhere();
      expect(where.categoryId).toBeInstanceOf(FindOperator);
      expect(where.categoryId.type).toBe('in');
      expect(where.categoryId.value).toEqual(categoryIds);
      expect(where).toMatchObject({ tenantId: TENANT, organisationId: ORG });
    });

    it('keeps the existing filters when categoryId is not provided', async () => {
      await service.search({}, TENANT, ORG);

      const where = searchWhere();
      expect(where).not.toHaveProperty('categoryId');
      expect(Object.keys(where).sort()).toEqual([
        'organisationId',
        'status',
        'tenantId',
      ]);
      expect(where.status.value).toBe(CourseStatus.ARCHIVED);
    });

    it('applies the category filter to every keyword-search branch', async () => {
      await service.search(
        { query: 'intro', categoryId: [CATEGORY_ID] },
        TENANT,
        ORG,
      );

      const where = searchWhere();
      expect(Array.isArray(where)).toBe(true);
      where.forEach((branch: any) =>
        expect(branch.categoryId.value).toEqual([CATEGORY_ID]),
      );
    });
  });
});
