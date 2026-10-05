import { FindOperator } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
// Load the lesson entity first to resolve the entity import cycle the same way the app does
import '../lessons/entities/lesson.entity';
import { CoursesService } from './courses.service';
import { SearchCourseDto } from './dto/search-course.dto';
import { EnrollmentStatus } from '../enrollments/entities/user-enrollment.entity';
import { ModuleTrackStatus } from '../tracking/entities/module-track.entity';
import { TrackingStatus } from '../tracking/entities/course-track.entity';

const TENANT = 'tenant-1';
const ORG = 'org-1';
const USER = 'user-1';

/** Chainable QueryBuilder mock that records calls and resolves to the given results */
const makeQueryBuilder = (raw: any[] = [], many: any[] = []) => {
  const qb: any = {};
  for (const method of [
    'select',
    'addSelect',
    'innerJoin',
    'where',
    'andWhere',
    'groupBy',
    'distinctOn',
    'orderBy',
    'addOrderBy',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(raw);
  qb.getMany = jest.fn().mockResolvedValue(many);
  return qb;
};

describe('CoursesService.search - hasEnroll', () => {
  let service: CoursesService;
  let courseRepository: any;
  let moduleQb: any;
  let enrollmentCountQb: any;
  let enrollmentQb: any;
  let moduleTrackQb: any;
  let courseTrackQb: any;
  let userEnrollmentRepository: any;
  let cacheService: any;

  const courses = [
    { courseId: 'course-1', title: 'Course 1' },
    { courseId: 'course-2', title: 'Course 2' },
  ];
  const courseTrack = {
    courseTrackId: 'track-1',
    courseId: 'course-1',
    userId: USER,
    status: TrackingStatus.INCOMPLETE,
  };
  const enrollment = {
    enrollmentId: 'enrollment-1',
    courseId: 'course-1',
    userId: USER,
    status: EnrollmentStatus.PUBLISHED,
  };

  beforeEach(() => {
    courseRepository = {
      findAndCount: jest.fn().mockResolvedValue([courses, 2]),
    };
    moduleQb = makeQueryBuilder([
      { courseId: 'course-1', count: '4' },
      { courseId: 'course-2', count: '2' },
    ]);
    enrollmentCountQb = makeQueryBuilder([
      { courseId: 'course-1', count: '7' },
    ]);
    enrollmentQb = makeQueryBuilder([], [enrollment]);
    moduleTrackQb = makeQueryBuilder([{ courseId: 'course-1', count: '3' }]);
    courseTrackQb = makeQueryBuilder([], [courseTrack]);
    // The enrollment repository serves the existing count query first, then the enrollment-details query
    userEnrollmentRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(enrollmentCountQb)
        .mockReturnValueOnce(enrollmentQb),
    };
    cacheService = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

    service = new CoursesService(
      courseRepository,
      { createQueryBuilder: jest.fn(() => moduleQb) } as any, // moduleRepository
      {} as any, // lessonRepository
      { createQueryBuilder: jest.fn(() => courseTrackQb) } as any, // courseTrackRepository
      {} as any, // lessonTrackRepository
      { createQueryBuilder: jest.fn(() => moduleTrackQb) } as any, // moduleTrackRepository
      {} as any, // mediaRepository
      {} as any, // associatedFileRepository
      userEnrollmentRepository,
      cacheService,
      {
        getCourseSearchKey: jest.fn(() => 'search-key'),
        COURSE_TTL: 60,
      } as any,
      {} as any, // modulesService
      {} as any, // orderingService
      {} as any, // configService
    );
  });

  const searchWhere = () =>
    courseRepository.findAndCount.mock.calls[0][0].where;
  const enrollmentSql = (operator: FindOperator<any>) =>
    (operator as any).getSql('"Course"."courseId"') as string;

  it('hasEnroll not provided: unchanged query, cached, no user-specific queries', async () => {
    const result = await service.search({}, TENANT, ORG);

    expect(searchWhere()).not.toHaveProperty('courseId');
    expect(cacheService.get).toHaveBeenCalled();
    expect(cacheService.set).toHaveBeenCalled();
    expect(moduleTrackQb.getRawMany).not.toHaveBeenCalled();
    expect(courseTrackQb.getMany).not.toHaveBeenCalled();
    expect(userEnrollmentRepository.createQueryBuilder).toHaveBeenCalledTimes(
      1,
    ); // existing count only
    expect(result.courses[0]).not.toHaveProperty('completedModuleCount');
    expect(result.courses[0]).not.toHaveProperty('enrollment');
    expect(result.courses[0]).toMatchObject({
      moduleCount: 4,
      enrolledUsersCount: 7,
    });
  });

  it('hasEnroll=false: excludes enrolled courses in the database query only', async () => {
    const result = await service.search(
      { hasEnroll: false, userId: USER },
      TENANT,
      ORG,
    );

    const condition = searchWhere().courseId;
    expect(condition).toBeInstanceOf(FindOperator);
    expect(condition.type).toBe('raw');
    expect(enrollmentSql(condition)).toMatch(
      /^NOT EXISTS \(SELECT 1 FROM "user_enrollments"/,
    );
    expect(enrollmentSql(condition)).toContain('= "Course"."courseId"');
    expect(condition.objectLiteralParameters).toEqual({
      enrollmentUserId: USER,
      enrollmentTenantId: TENANT,
      enrollmentOrganisationId: ORG,
      enrollmentStatus: EnrollmentStatus.PUBLISHED,
    });
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
    expect(moduleTrackQb.getRawMany).not.toHaveBeenCalled();
    expect(courseTrackQb.getMany).not.toHaveBeenCalled();
    expect(enrollmentQb.getMany).not.toHaveBeenCalled();
    expect(result.courses[0]).not.toHaveProperty('completedModuleCount');
    expect(result.totalElements).toBe(2);
  });

  it('hasEnroll=true: only enrolled courses, enriched with 3 batched queries', async () => {
    const result = await service.search(
      { hasEnroll: true, userId: USER },
      TENANT,
      ORG,
    );

    const condition = searchWhere().courseId;
    expect(enrollmentSql(condition)).toMatch(
      /^EXISTS \(SELECT 1 FROM "user_enrollments"/,
    );
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();

    // One query each for the whole page, never per course
    expect(moduleTrackQb.getRawMany).toHaveBeenCalledTimes(1);
    expect(courseTrackQb.getMany).toHaveBeenCalledTimes(1);
    expect(enrollmentQb.getMany).toHaveBeenCalledTimes(1);
    expect(moduleTrackQb.where).toHaveBeenCalledWith(
      'module.courseId IN (:...courseIds)',
      { courseIds: ['course-1', 'course-2'] },
    );
    expect(moduleTrackQb.andWhere).toHaveBeenCalledWith(
      'moduleTrack.status = :completedStatus',
      { completedStatus: ModuleTrackStatus.COMPLETED },
    );
    expect(moduleTrackQb.addSelect).toHaveBeenCalledWith(
      'COUNT(DISTINCT moduleTrack.moduleId)',
      'count',
    );
    // "Latest" is chosen by the database
    expect(courseTrackQb.distinctOn).toHaveBeenCalledWith([
      'courseTrack.courseId',
    ]);
    expect(courseTrackQb.addOrderBy).toHaveBeenCalledWith(
      'courseTrack.lastAccessedDate',
      'DESC',
      'NULLS LAST',
    );
    expect(enrollmentQb.distinctOn).toHaveBeenCalledWith([
      'enrollment.courseId',
    ]);
    expect(enrollmentQb.addOrderBy).toHaveBeenCalledWith(
      'enrollment.enrolledAt',
      'DESC',
    );

    expect(result.courses[0]).toMatchObject({
      courseId: 'course-1',
      moduleCount: 4,
      completedModuleCount: 3,
      courseTracking: { courseTrackId: 'track-1' },
      enrollment: { enrollmentId: 'enrollment-1' },
    });
    // No tracking/completion yet for course-2
    expect(result.courses[1]).toMatchObject({
      courseId: 'course-2',
      moduleCount: 2,
      completedModuleCount: 0,
      courseTracking: null,
      enrollment: null,
    });
  });

  it('applies the enrollment condition to every keyword-search branch', async () => {
    await service.search(
      { hasEnroll: false, userId: USER, query: 'intro' },
      TENANT,
      ORG,
    );

    const where = searchWhere();
    expect(Array.isArray(where)).toBe(true);
    where.forEach((branch: any) =>
      expect(enrollmentSql(branch.courseId)).toMatch(/^NOT EXISTS/),
    );
  });

  it('runs no enrichment queries when the page is empty', async () => {
    courseRepository.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.search(
      { hasEnroll: true, userId: USER },
      TENANT,
      ORG,
    );

    expect(result.courses).toEqual([]);
    expect(moduleTrackQb.getRawMany).not.toHaveBeenCalled();
    expect(courseTrackQb.getMany).not.toHaveBeenCalled();
  });
});

describe('SearchCourseDto hasEnroll validation', () => {
  // Mirrors the global ValidationPipe options in main.ts
  const toDto = (plain: object) =>
    plainToInstance(SearchCourseDto, plain, { enableImplicitConversion: true });
  const errorFields = async (plain: object) =>
    (await validate(toDto(plain))).map((e) => e.property);

  it('does not require userId when hasEnroll is not provided', async () => {
    expect(await errorFields({})).toEqual([]);
    expect(toDto({}).hasEnroll).toBeUndefined();
  });

  it.each(['true', 'false'])(
    'requires userId when hasEnroll=%s',
    async (value) => {
      expect(await errorFields({ hasEnroll: value })).toEqual(['userId']);
      expect(await errorFields({ hasEnroll: value, userId: '' })).toEqual([
        'userId',
      ]);
    },
  );

  it.each([
    ['true', true],
    ['false', false],
  ])('parses hasEnroll=%s with a userId', async (value, expected) => {
    const dto = toDto({ hasEnroll: value, userId: USER });
    expect(await errorFields({ hasEnroll: value, userId: USER })).toEqual([]);
    expect(dto.hasEnroll).toBe(expected);
  });

  it('rejects a non-boolean hasEnroll', async () => {
    expect(await errorFields({ hasEnroll: 'yes', userId: USER })).toEqual([
      'hasEnroll',
    ]);
  });
});
