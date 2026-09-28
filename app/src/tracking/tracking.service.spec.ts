import { FindOperator } from 'typeorm';
// Load the lesson entity first to resolve the entity import cycle the same way the app does
import '../lessons/entities/lesson.entity';
import { TrackingService } from './tracking.service';
import { TrackingStatus } from './entities/course-track.entity';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';
const COURSE_ID = 'course-1';

const isNullOperator = (value: unknown) =>
  value instanceof FindOperator && value.type === 'isNull';

describe('TrackingService - independent lessons', () => {
  let service: TrackingService;
  let lessonRepository: any;
  let lessonTrackRepository: any;
  let courseTrackRepository: any;
  let updateCourseAndModuleTracking: jest.SpyInstance;

  const lesson = (overrides: object = {}) => ({
    lessonId: 'lesson-1',
    courseId: null,
    moduleId: null,
    prerequisites: [],
    noOfAttempts: 0,
    resume: true,
    allowResubmission: false,
    ...overrides,
  });

  beforeEach(() => {
    lessonRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    lessonTrackRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (data) => ({ lessonTrackId: 'track-1', ...data })),
    };
    courseTrackRepository = { findOne: jest.fn() };

    service = new TrackingService(
      courseTrackRepository,
      lessonTrackRepository,
      {} as any,
      lessonRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    updateCourseAndModuleTracking = jest
      .spyOn(service, 'updateCourseAndModuleTracking')
      .mockResolvedValue(undefined);
  });

  describe('startLessonAttempt', () => {
    it('creates a lesson track with courseId null and skips course/module tracking', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson());

      const track = await service.startLessonAttempt(
        'lesson-1',
        USER,
        TENANT,
        ORG,
      );

      const where = lessonTrackRepository.find.mock.calls[0][0].where;
      expect(isNullOperator(where.courseId)).toBe(true);
      expect(track).toMatchObject({
        courseId: null,
        attempt: 1,
        status: TrackingStatus.STARTED,
      });
      expect(updateCourseAndModuleTracking).not.toHaveBeenCalled();
    });

    it('checks prerequisites of an independent lesson against independent tracks', async () => {
      lessonRepository.findOne.mockResolvedValue(
        lesson({ prerequisites: ['lesson-0'] }),
      );
      lessonRepository.find.mockResolvedValue([
        { lessonId: 'lesson-0', title: 'Pre' },
      ]);
      // Completed prerequisite tracks are queried with a status filter; existing tracks are not
      lessonTrackRepository.find.mockImplementation(async ({ where }) =>
        where.status === TrackingStatus.COMPLETED
          ? [{ lessonId: 'lesson-0' }]
          : [],
      );

      await service.startLessonAttempt('lesson-1', USER, TENANT, ORG);

      const prerequisiteCall = lessonTrackRepository.find.mock.calls.find(
        ([options]) => options.where.status === TrackingStatus.COMPLETED,
      );
      expect(isNullOperator(prerequisiteCall[0].where.courseId)).toBe(true);
    });

    it('keeps the existing behaviour for course lessons', async () => {
      lessonRepository.findOne.mockResolvedValue(
        lesson({ courseId: COURSE_ID, moduleId: 'module-1' }),
      );

      const track = await service.startLessonAttempt(
        'lesson-1',
        USER,
        TENANT,
        ORG,
        'auth',
      );

      expect(lessonTrackRepository.find.mock.calls[0][0].where.courseId).toBe(
        COURSE_ID,
      );
      expect(track.courseId).toBe(COURSE_ID);
      expect(updateCourseAndModuleTracking).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: COURSE_ID }),
        TENANT,
        ORG,
        'auth',
      );
    });

    it('returns the incomplete attempt of an independent lesson when resume is allowed', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson());
      const incomplete = {
        lessonTrackId: 'track-0',
        attempt: 1,
        status: TrackingStatus.INCOMPLETE,
      };
      lessonTrackRepository.find.mockResolvedValue([incomplete]);

      await expect(
        service.startLessonAttempt('lesson-1', USER, TENANT, ORG),
      ).resolves.toBe(incomplete);
      expect(lessonTrackRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('manageLessonAttempt', () => {
    it('starts over an independent lesson with the next attempt number', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson({ noOfAttempts: 3 }));
      lessonTrackRepository.find.mockResolvedValue([
        { attempt: 1, status: TrackingStatus.INCOMPLETE },
      ]);

      const track = await service.manageLessonAttempt(
        'lesson-1',
        'start',
        USER,
        TENANT,
        ORG,
      );

      expect(
        isNullOperator(
          lessonTrackRepository.find.mock.calls[0][0].where.courseId,
        ),
      ).toBe(true);
      expect(track).toMatchObject({ courseId: null, attempt: 2 });
    });

    it('starts over a course lesson with the next attempt number', async () => {
      lessonRepository.findOne.mockResolvedValue(
        lesson({ courseId: COURSE_ID, noOfAttempts: 3 }),
      );
      lessonTrackRepository.find.mockResolvedValue([
        { attempt: 2, status: TrackingStatus.INCOMPLETE },
      ]);

      const track = await service.manageLessonAttempt(
        'lesson-1',
        'start',
        USER,
        TENANT,
        ORG,
      );

      expect(track).toMatchObject({ courseId: COURSE_ID, attempt: 3 });
    });
  });

  describe('getLessonStatus', () => {
    it('returns status for an independent lesson instead of failing', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson());

      const status = await service.getLessonStatus(
        'lesson-1',
        USER,
        TENANT,
        ORG,
      );

      expect(
        isNullOperator(
          lessonTrackRepository.findOne.mock.calls[0][0].where.courseId,
        ),
      ).toBe(true);
      expect(status).toMatchObject({ canReattempt: true, isEligible: true });
    });
  });

  describe('updateProgress', () => {
    it('does not update course/module tracking for an independent lesson', async () => {
      lessonTrackRepository.findOne.mockResolvedValue({
        lessonTrackId: 'track-1',
        courseId: null,
        status: TrackingStatus.STARTED,
      });

      const result = await service.updateProgress(
        'track-1',
        { lessonId: 'lesson-1', currentPosition: 10, totalContent: 10 } as any,
        USER,
        TENANT,
        ORG,
      );

      expect(result.status).toBe(TrackingStatus.COMPLETED);
      expect(updateCourseAndModuleTracking).not.toHaveBeenCalled();
    });
  });

  describe('updateCourseAndModuleTracking', () => {
    it('never touches course tracking when the lesson track has no course', async () => {
      updateCourseAndModuleTracking.mockRestore();
      await service.updateCourseAndModuleTracking(
        { courseId: null } as any,
        TENANT,
        ORG,
      );
      expect(courseTrackRepository.findOne).not.toHaveBeenCalled();
    });
  });
});
