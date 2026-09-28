import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonFormat, LessonSubFormat } from './entities/lesson.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';
const COURSE_ID = 'course-1';
const MODULE_ID = 'module-1';

describe('LessonsService - independent lessons', () => {
  let service: LessonsService;
  let lessonRepository: any;
  let courseRepository: any;
  let moduleRepository: any;
  let mediaRepository: any;
  let orderingService: any;
  let recalculateProgressQueueService: any;

  beforeEach(() => {
    lessonRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (data) => ({ lessonId: 'new-lesson', ...data })),
      update: jest.fn(),
    };
    courseRepository = {
      findOne: jest.fn().mockResolvedValue({ courseId: COURSE_ID }),
    };
    moduleRepository = {
      findOne: jest.fn().mockResolvedValue({ moduleId: MODULE_ID }),
    };
    mediaRepository = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (data) => ({ mediaId: 'media-1', ...data })),
    };
    orderingService = {
      getNextLessonOrder: jest.fn().mockResolvedValue(5),
    };
    recalculateProgressQueueService = { enqueueJob: jest.fn() };
    const cacheService = {
      set: jest.fn(),
      del: jest.fn(),
      invalidateLesson: jest.fn(),
      invalidateLessonDetailCached: jest.fn(),
      invalidateCourseHierarchyCache: jest.fn(),
      invalidateCourseEnrollments: jest.fn(),
    };
    const cacheConfig = {
      getLessonKey: jest.fn(() => 'lesson-key'),
      LESSON_TTL: 60,
    };
    const configService = { get: jest.fn() };

    service = new LessonsService(
      lessonRepository,
      courseRepository,
      moduleRepository,
      mediaRepository,
      {} as any,
      cacheService as any,
      configService as any,
      cacheConfig as any,
      orderingService,
      recalculateProgressQueueService,
    );
  });

  const createDto = (
    overrides: Partial<CreateLessonDto> = {},
  ): CreateLessonDto =>
    ({
      title: 'Intro',
      alias: 'intro',
      format: LessonFormat.VIDEO,
      mediaContentSource: 'https://youtube.com/watch?v=x',
      mediaContentSubFormat: LessonSubFormat.YOUTUBE,
      considerForPassing: true,
      ...overrides,
    }) as CreateLessonDto;

  describe('create', () => {
    it('creates an independent lesson without course/module lookups or progress recalculation', async () => {
      const lesson = await service.create(createDto(), USER, TENANT, ORG);

      expect(courseRepository.findOne).not.toHaveBeenCalled();
      expect(moduleRepository.findOne).not.toHaveBeenCalled();
      expect(orderingService.getNextLessonOrder).not.toHaveBeenCalled();
      expect(recalculateProgressQueueService.enqueueJob).not.toHaveBeenCalled();
      expect(lesson.courseId).toBeUndefined();
      expect(lesson.moduleId).toBeUndefined();
      expect(lesson.ordering).toBe(0);
    });

    it('creates a course lesson with the existing validation, ordering and recalculation', async () => {
      const lesson = await service.create(
        createDto({ courseId: COURSE_ID, moduleId: MODULE_ID }),
        USER,
        TENANT,
        ORG,
      );

      expect(courseRepository.findOne).toHaveBeenCalled();
      expect(moduleRepository.findOne.mock.calls[0][0].where).toMatchObject({
        moduleId: MODULE_ID,
        courseId: COURSE_ID,
      });
      expect(lesson.courseId).toBe(COURSE_ID);
      expect(lesson.moduleId).toBe(MODULE_ID);
      expect(lesson.ordering).toBe(5);
      expect(recalculateProgressQueueService.enqueueJob).toHaveBeenCalledWith(
        COURSE_ID,
        TENANT,
        ORG,
      );
    });

    it.each([
      ['only courseId', { courseId: COURSE_ID }],
      ['only moduleId', { moduleId: MODULE_ID }],
    ])('rejects %s before creating media', async (_label, ids) => {
      await expect(
        service.create(createDto(ids), USER, TENANT, ORG),
      ).rejects.toThrow(
        new BadRequestException(
          RESPONSE_MESSAGES.ERROR.COURSE_AND_MODULE_REQUIRED_TOGETHER,
        ),
      );
      expect(mediaRepository.save).not.toHaveBeenCalled();
    });

    it.each([LessonFormat.ASSESSMENT, LessonFormat.EVENT])(
      'rejects an independent %s lesson',
      async (format) => {
        await expect(
          service.create(createDto({ format }), USER, TENANT, ORG),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mediaRepository.save).not.toHaveBeenCalled();
      },
    );

    it('rejects a module that does not belong to the course', async () => {
      moduleRepository.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          createDto({ courseId: COURSE_ID, moduleId: MODULE_ID }),
          USER,
          TENANT,
          ORG,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    const existing = {
      lessonId: 'lesson-1',
      courseId: COURSE_ID,
      moduleId: MODULE_ID,
      format: LessonFormat.VIDEO,
    };

    it.each([
      ['changing courseId', { courseId: 'other-course' }],
      ['changing moduleId', { moduleId: 'other-module' }],
      ['detaching courseId', { courseId: null }],
      ['detaching moduleId', { moduleId: null }],
    ])('rejects %s', async (_label, dto) => {
      lessonRepository.findOne.mockResolvedValue(existing);
      await expect(
        service.update('lesson-1', dto as UpdateLessonDto, USER, TENANT, ORG),
      ).rejects.toThrow(
        new BadRequestException(
          RESPONSE_MESSAGES.ERROR.LESSON_COURSE_MODULE_UPDATE_NOT_ALLOWED,
        ),
      );
    });

    it('rejects attaching an independent lesson to a course', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...existing,
        courseId: null,
        moduleId: null,
      });
      await expect(
        service.update(
          'lesson-1',
          { courseId: COURSE_ID, moduleId: MODULE_ID } as UpdateLessonDto,
          USER,
          TENANT,
          ORG,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          RESPONSE_MESSAGES.ERROR.LESSON_COURSE_MODULE_UPDATE_NOT_ALLOWED,
        ),
      );
    });

    it('accepts re-sending the current courseId and moduleId', async () => {
      lessonRepository.findOne.mockResolvedValue(existing);
      // checkedOut is rejected right after the course/module check, proving that check passed
      await expect(
        service.update(
          'lesson-1',
          {
            courseId: COURSE_ID,
            moduleId: MODULE_ID,
            checkedOut: 'x',
          } as UpdateLessonDto,
          USER,
          TENANT,
          ORG,
        ),
      ).rejects.toThrow(
        new BadRequestException(RESPONSE_MESSAGES.ERROR.LESSON_CHECKED_OUT),
      );
    });
  });
});
