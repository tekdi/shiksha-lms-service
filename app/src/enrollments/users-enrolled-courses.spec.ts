import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
// Load the lesson entity first to resolve the entity import cycle the same way the app does
import '../lessons/entities/lesson.entity';
import { EnrollmentsService } from './enrollments.service';
import { UsersEnrolledCoursesDto } from './dto/search-enrolled-courses.dto';
import { CourseStatus } from '../courses/entities/course.entity';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';

/** Chainable QueryBuilder mock that records calls */
const makeQueryBuilder = (result: {
  many?: any[];
  raw?: any[];
  manyAndCount?: [any[], number];
}) => {
  const qb: any = {};
  for (const method of [
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'setParameters',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  qb.getRawMany = jest.fn().mockResolvedValue(result.raw ?? []);
  qb.getManyAndCount = jest
    .fn()
    .mockResolvedValue(result.manyAndCount ?? [[], 0]);
  return qb;
};

describe('EnrollmentsService.usersEnrolledCourses - hasEnroll', () => {
  let service: EnrollmentsService;
  let enrollmentQb: any;
  let courseQueryBuilders: any[];
  let courseRepository: any;
  let courseTrackRepository: any;
  let moduleTrackRepository: any;

  const courses = [
    {
      courseId: 'course-1',
      title: 'Course 1',
      status: CourseStatus.PUBLISHED,
      ordering: 1,
    },
    {
      courseId: 'course-2',
      title: 'Course 2',
      status: CourseStatus.PUBLISHED,
      ordering: 2,
    },
  ];

  const setup = (courseQbs: any[]) => {
    enrollmentQb = makeQueryBuilder({
      many: courses.map((c) => ({ courseId: c.courseId, userId: USER })),
    });
    courseQueryBuilders = courseQbs;
    courseRepository = {
      createQueryBuilder: jest.fn(() => courseQueryBuilders.shift()),
    };
    courseTrackRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
    moduleTrackRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
    service = new EnrollmentsService(
      { createQueryBuilder: jest.fn(() => enrollmentQb) } as any,
      courseRepository,
      courseTrackRepository,
      {} as any, // moduleRepository
      moduleTrackRepository,
      {} as any, // lessonTrackRepository
      {
        getCourseMetaCached: jest.fn().mockResolvedValue(null),
        setCourseMetaCached: jest.fn(),
      } as any,
      {} as any, // configService
      {} as any, // lessonRepository
      {} as any, // dataSource
      {} as any, // cacheConfig
    );
  };

  const sqlOf = (qb: any, method: string) =>
    qb[method].mock.calls.map((args: any[]) => String(args[0])).join('\n');

  it('hasEnroll not provided: existing queries only, no progress fields', async () => {
    const metaQb = makeQueryBuilder({ many: courses });
    setup([metaQb]);

    const result = await service.usersEnrolledCourses(
      { userId: USER, offset: 0, limit: 10 },
      TENANT,
      ORG,
    );

    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(1); // course metadata only
    expect(sqlOf(metaQb, 'addSelect')).toBe('');
    expect(result.totalElements).toBe(2);
    result.courses.forEach((course) => {
      expect(course).not.toHaveProperty('totalModuleCount');
      expect(course).not.toHaveProperty('enrollment');
    });
  });

  it('hasEnroll=true: one extra query with subqueries for counts, latest tracking and latest enrollment', async () => {
    const metaQb = makeQueryBuilder({ many: courses });
    const progressQb = makeQueryBuilder({
      raw: [
        {
          courseId: 'course-1',
          totalModuleCount: '3',
          completedModuleCount: '2',
          courseTracking: { courseTrackId: 'track-1' },
          enrollment: { enrollmentId: 'enrollment-1' },
        },
      ],
    });
    setup([metaQb, progressQb]);

    const result = await service.usersEnrolledCourses(
      { userId: USER, hasEnroll: true, offset: 0, limit: 10 },
      TENANT,
      ORG,
    );

    // Exactly one extra query for the whole page, never one per course
    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(progressQb.getRawMany).toHaveBeenCalledTimes(1);
    expect(progressQb.where).toHaveBeenCalledWith(
      'course.courseId IN (:...courseIds)',
      { courseIds: ['course-1', 'course-2'] },
    );
    const selects = sqlOf(progressQb, 'addSelect');
    expect(selects).toContain('SELECT COUNT(*) FROM "modules"');
    expect(selects).toContain('COUNT(DISTINCT "moduleTrack"."moduleId")');
    expect(selects).toContain(
      'ORDER BY "courseTrack"."lastAccessedDate" DESC NULLS LAST LIMIT 1',
    );
    expect(selects).toContain(
      'ORDER BY "enrollment"."enrolledAt" DESC LIMIT 1',
    );
    expect(progressQb.setParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        tenantId: TENANT,
        organisationId: ORG,
      }),
    );
    // No repository-level tracking/module queries
    expect(courseTrackRepository.find).not.toHaveBeenCalled();
    expect(moduleTrackRepository.find).not.toHaveBeenCalled();

    expect(result.courses[0]).toMatchObject({
      courseId: 'course-1',
      totalModuleCount: 3,
      completedModuleCount: 2,
      courseTracking: { courseTrackId: 'track-1' },
      enrollment: { enrollmentId: 'enrollment-1' },
    });
    expect(result.courses[1]).toMatchObject({
      courseId: 'course-2',
      totalModuleCount: 0,
      completedModuleCount: 0,
      courseTracking: null,
      enrollment: null,
    });
  });

  it('hasEnroll=false: one course query with NOT EXISTS, paginated in the database', async () => {
    const notEnrolledQb = makeQueryBuilder({
      manyAndCount: [[courses[1]], 5],
    });
    setup([notEnrolledQb]);

    const result = await service.usersEnrolledCourses(
      {
        userId: USER,
        hasEnroll: false,
        cohortId: 'coh-1',
        offset: 2,
        limit: 1,
      },
      TENANT,
      ORG,
    );

    expect(enrollmentQb.getMany).not.toHaveBeenCalled(); // enrolled-course flow is skipped
    expect(courseRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    const conditions = sqlOf(notEnrolledQb, 'andWhere');
    expect(conditions).toContain(
      'NOT EXISTS (SELECT 1 FROM "user_enrollments" "enrollment"',
    );
    expect(conditions).toContain(`course.params->>'cohortId' = :cohortId`);
    expect(notEnrolledQb.orderBy).toHaveBeenCalledWith(
      'course.ordering',
      'ASC',
    );
    expect(notEnrolledQb.skip).toHaveBeenCalledWith(2);
    expect(notEnrolledQb.take).toHaveBeenCalledWith(1);
    expect(courseTrackRepository.find).not.toHaveBeenCalled();
    expect(result).toEqual({
      courses: [courses[1]],
      totalElements: 5,
      offset: 2,
      limit: 1,
    });
  });
});

describe('UsersEnrolledCoursesDto hasEnroll validation', () => {
  // Mirrors the global ValidationPipe options in main.ts
  const toDto = (plain: object) =>
    plainToInstance(UsersEnrolledCoursesDto, plain, {
      enableImplicitConversion: true,
    });
  const errorFields = async (plain: object) =>
    (await validate(toDto(plain))).map((e) => e.property);

  it('keeps userId optional when hasEnroll is not provided (existing behaviour)', async () => {
    expect(await errorFields({})).toEqual([]);
    expect(await errorFields({ userId: '' })).toEqual([]);
    expect(await errorFields({ userId: USER })).toEqual([]);
  });

  it.each(['true', 'false'])(
    'requires userId when hasEnroll=%s',
    async (value) => {
      expect(await errorFields({ hasEnroll: value })).toEqual(['userId']);
      expect(await errorFields({ hasEnroll: value, userId: ' ' })).toEqual([
        'userId',
      ]);
    },
  );

  it.each([
    ['true', true],
    ['false', false],
  ])('parses hasEnroll=%s', async (value, expected) => {
    expect(await errorFields({ hasEnroll: value, userId: USER })).toEqual([]);
    expect(toDto({ hasEnroll: value, userId: USER }).hasEnroll).toBe(expected);
  });

  it('rejects a non-boolean hasEnroll', async () => {
    expect(await errorFields({ hasEnroll: 'yes', userId: USER })).toEqual([
      'hasEnroll',
    ]);
  });
});
