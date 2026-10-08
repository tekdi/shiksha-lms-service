// Load the lesson entity first to resolve the entity import cycle the same way the app does
import '../lessons/entities/lesson.entity';
import { TrackingService } from './tracking.service';
import { TrackingStatus } from './entities/course-track.entity';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';
const COURSE_ID = 'course-1';

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
    it('creates a lesson track without a course and skips course/module tracking', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson());

      const track = await service.startLessonAttempt(
        'lesson-1',
        USER,
        TENANT,
        ORG,
      );

      // Tracks are looked up by lesson; independent lessons get no courseId
      const where = lessonTrackRepository.find.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('courseId');
      expect(track).toMatchObject({
        attempt: 1,
        status: TrackingStatus.STARTED,
      });
      expect(track.courseId ?? null).toBeNull();
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
      expect(prerequisiteCall[0].where).not.toHaveProperty('courseId');
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

      // The track stores the lesson's course, so course-scoped reads (hierarchy) find it
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
        lessonTrackRepository.find.mock.calls[0][0].where,
      ).not.toHaveProperty('courseId');
      expect(track).toMatchObject({ attempt: 2 });
      expect(track.courseId ?? null).toBeNull();
    });

    it('starts over a course lesson with the next attempt number', async () => {
      lessonRepository.findOne.mockResolvedValue(
        lesson({ courseId: COURSE_ID, moduleId: 'module-1', noOfAttempts: 3 }),
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
        lessonTrackRepository.findOne.mock.calls[0][0].where,
      ).not.toHaveProperty('courseId');
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

  describe('hierarchy sync trigger (lesson course/module)', () => {
    it.each([
      [
        'course + module',
        { courseId: COURSE_ID, moduleId: 'module-1' },
        true,
        COURSE_ID,
      ],
      ['module only', { courseId: null, moduleId: 'module-1' }, true, null],
      ['course only', { courseId: COURSE_ID, moduleId: null }, true, COURSE_ID],
      [
        'neither (independent)',
        { courseId: null, moduleId: null },
        false,
        null,
      ],
    ])(
      'startLessonAttempt with %s lesson',
      async (_label, ids, shouldSync, expectedCourseId) => {
        lessonRepository.findOne.mockResolvedValue(lesson(ids));

        const track = await service.startLessonAttempt(
          'lesson-1',
          USER,
          TENANT,
          ORG,
        );

        expect(track.courseId ?? null).toBe(expectedCourseId);
        if (shouldSync) {
          expect(updateCourseAndModuleTracking).toHaveBeenCalledTimes(1);
        } else {
          expect(updateCourseAndModuleTracking).not.toHaveBeenCalled();
        }
      },
    );

    it('updateProgress repairs a course lesson track saved without courseId and syncs it on completion', async () => {
      lessonTrackRepository.findOne.mockResolvedValue({
        lessonTrackId: 'track-1',
        courseId: null,
        status: TrackingStatus.STARTED,
        lesson: {
          lessonId: 'lesson-1',
          courseId: COURSE_ID,
          moduleId: 'module-1',
        },
      });

      const result = await service.updateProgress(
        'track-1',
        { lessonId: 'lesson-1', currentPosition: 10, totalContent: 10 } as any,
        USER,
        TENANT,
        ORG,
        'auth',
      );

      expect(result).toMatchObject({
        courseId: COURSE_ID,
        status: TrackingStatus.COMPLETED,
      });
      expect(updateCourseAndModuleTracking).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: COURSE_ID }),
        TENANT,
        ORG,
        'auth',
      );
    });

    it('updateProgress does not sync while the lesson is still in progress', async () => {
      lessonTrackRepository.findOne.mockResolvedValue({
        lessonTrackId: 'track-1',
        status: TrackingStatus.STARTED,
        lesson: {
          lessonId: 'lesson-1',
          courseId: COURSE_ID,
          moduleId: 'module-1',
        },
      });

      const result = await service.updateProgress(
        'track-1',
        { lessonId: 'lesson-1', currentPosition: 3, totalContent: 10 } as any,
        USER,
        TENANT,
        ORG,
      );

      expect(result.status).toBe(TrackingStatus.INCOMPLETE);
      expect(updateCourseAndModuleTracking).not.toHaveBeenCalled();
    });

    it('updateProgress syncs a module-only lesson on completion', async () => {
      lessonTrackRepository.findOne.mockResolvedValue({
        lessonTrackId: 'track-1',
        status: TrackingStatus.STARTED,
        lesson: { lessonId: 'lesson-1', courseId: null, moduleId: 'module-1' },
      });

      await service.updateProgress(
        'track-1',
        { lessonId: 'lesson-1', status: TrackingStatus.COMPLETED } as any,
        USER,
        TENANT,
        ORG,
      );

      expect(updateCourseAndModuleTracking).toHaveBeenCalledTimes(1);
    });

    it('manageLessonAttempt stores the course on a restarted attempt', async () => {
      lessonRepository.findOne.mockResolvedValue(
        lesson({ courseId: COURSE_ID, moduleId: 'module-1', noOfAttempts: 3 }),
      );
      lessonTrackRepository.find.mockResolvedValue([
        { attempt: 1, status: TrackingStatus.INCOMPLETE, courseId: null },
      ]);

      const track = await service.manageLessonAttempt(
        'lesson-1',
        'start',
        USER,
        TENANT,
        ORG,
      );

      expect(track.courseId).toBe(COURSE_ID);
    });

    it('applyLessonHierarchy leaves independent lesson tracks untouched', () => {
      const track: any = { courseId: null };
      expect(
        service.applyLessonHierarchy(track, {
          courseId: null,
          moduleId: null,
        } as any),
      ).toBe(false);
      expect(service.applyLessonHierarchy(track, null)).toBe(false);
      expect(track.courseId).toBeNull();
    });
  });

  describe('updateCourseAndModuleTracking (independent course and module sync)', () => {
    let syncCourseTracking: jest.SpyInstance;
    let updateModuleTracking: jest.SpyInstance;

    beforeEach(() => {
      updateCourseAndModuleTracking.mockRestore();
      syncCourseTracking = jest
        .spyOn(service as any, 'syncCourseTracking')
        .mockResolvedValue(undefined);
      updateModuleTracking = jest
        .spyOn(service as any, 'updateModuleTracking')
        .mockResolvedValue(undefined);
    });

    const trackFor = (ids: object) =>
      ({
        lessonId: 'lesson-1',
        userId: USER,
        tenantId: TENANT,
        organisationId: ORG,
        status: TrackingStatus.COMPLETED,
        lesson: { lessonId: 'lesson-1', ...ids },
      }) as any;

    it.each([
      [
        'course + module',
        { courseId: COURSE_ID, moduleId: 'module-1' },
        true,
        true,
      ],
      ['module only', { courseId: null, moduleId: 'module-1' }, false, true],
      ['course only', { courseId: COURSE_ID, moduleId: null }, true, false],
      [
        'neither (independent)',
        { courseId: null, moduleId: null },
        false,
        false,
      ],
    ])(
      '%s lesson: syncs only the levels it belongs to',
      async (_label, ids, course, module) => {
        await service.updateCourseAndModuleTracking(
          trackFor(ids),
          TENANT,
          ORG,
          'auth',
        );

        if (course) {
          expect(syncCourseTracking).toHaveBeenCalledWith(
            expect.anything(),
            COURSE_ID,
            TENANT,
            ORG,
            'auth',
          );
        } else {
          expect(syncCourseTracking).not.toHaveBeenCalled();
        }
        if (module) {
          expect(updateModuleTracking).toHaveBeenCalledWith(
            'module-1',
            USER,
            TENANT,
            ORG,
            false,
          );
        } else {
          expect(updateModuleTracking).not.toHaveBeenCalled();
        }
      },
    );

    it('loads the lesson when the track has no lesson relation', async () => {
      lessonRepository.findOne.mockResolvedValue({
        courseId: null,
        moduleId: 'module-1',
      });
      await service.updateCourseAndModuleTracking(
        {
          lessonId: 'lesson-1',
          userId: USER,
          tenantId: TENANT,
          organisationId: ORG,
          status: TrackingStatus.COMPLETED,
        } as any,
        TENANT,
        ORG,
      );
      expect(updateModuleTracking).toHaveBeenCalledTimes(1);
      expect(syncCourseTracking).not.toHaveBeenCalled();
    });

    it('still syncs the module when the user has no course_track (not enrolled)', async () => {
      syncCourseTracking.mockRestore();
      courseTrackRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateCourseAndModuleTracking(
          trackFor({ courseId: COURSE_ID, moduleId: 'module-1' }),
          TENANT,
          ORG,
        ),
      ).resolves.toBeUndefined();
      expect(updateModuleTracking).toHaveBeenCalledTimes(1);
    });
  });
});
