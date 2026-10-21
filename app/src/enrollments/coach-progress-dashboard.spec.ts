import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EnrollmentsService } from './enrollments.service';
import { CoachProgressDashboardDto } from './dto/coach-progress-dashboard.dto';

const TENANT = 'brac';
const ORG = 'brac_gbl';

/** Chainable query builder fake that records every call. */
class FakeQueryBuilder {
  calls: { method: string; args: any[] }[] = [];
  params: Record<string, unknown> = {};

  constructor(
    readonly alias: string,
    private readonly results: {
      rawOne?: unknown;
      count?: number;
      rawMany?: unknown[];
    } = {},
  ) {
    return new Proxy(this, {
      get: (target, prop: string, proxy) => {
        if (prop in target) return (target as any)[prop];
        return (...args: any[]) => {
          target.calls.push({ method: prop, args });
          const withParams = args.find(
            (arg, index) => index > 0 && arg && typeof arg === 'object',
          );
          if (withParams) Object.assign(target.params, withParams);
          return proxy;
        };
      },
    });
  }

  setParameters(params: Record<string, unknown>) {
    this.calls.push({ method: 'setParameters', args: [params] });
    Object.assign(this.params, params);
    return this;
  }
  getQuery() {
    return `SUBQUERY(${this.alias})`;
  }
  getParameters() {
    return this.params;
  }
  getRawOne() {
    return Promise.resolve(this.results.rawOne);
  }
  getCount() {
    return Promise.resolve(this.results.count ?? 0);
  }
  getRawMany() {
    return Promise.resolve(this.results.rawMany ?? []);
  }

  args(method: string): any[][] {
    return this.calls.filter((c) => c.method === method).map((c) => c.args);
  }
  conditions(): string[] {
    return this.calls
      .filter((c) => ['where', 'andWhere'].includes(c.method))
      .map((c) => String(c.args[0]));
  }
  selects(): string[] {
    return this.calls
      .filter((c) => ['select', 'addSelect'].includes(c.method))
      .map((c) => String(c.args[0]));
  }
}

describe('EnrollmentsService - getCoachProgressDashboard', () => {
  let service: EnrollmentsService;
  let built: Record<string, FakeQueryBuilder[]>;
  let categoryRows: unknown[][];

  const repository = (name: string, results: Record<string, unknown>) => ({
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn((alias: string) => {
      const qb = new FakeQueryBuilder(alias, results);
      (built[name] ??= []).push(qb);
      return qb;
    }),
  });

  beforeEach(() => {
    built = {};
    categoryRows = [
      [{ categoryId: 'agriculture', completedCount: '2', totalCount: '5' }],
      [
        { categoryId: 'agriculture', completedCount: '7', totalCount: '9' },
        { categoryId: 'health', completedCount: null, totalCount: '3' },
      ],
    ];
    let categoryCall = 0;
    service = Object.create(EnrollmentsService.prototype);
    Object.assign(service, {
      logger: { log: jest.fn() },
      userEnrollmentRepository: repository('enrollment', {
        rawOne: { count: '13' },
      }),
      courseTrackRepository: repository('courseTrack', { count: 10 }),
      moduleTrackRepository: repository('moduleTrack', {
        rawOne: { count: '14' },
      }),
      lessonTrackRepository: repository('lessonTrack', {
        rawOne: { count: '30' },
      }),
      userCertificateRepository: repository('certificate', {
        rawOne: { count: '4' },
      }),
      dataSource: {
        createQueryBuilder: jest.fn(() => {
          const qb = new FakeQueryBuilder('tracked', {
            rawMany: categoryRows[categoryCall++],
          });
          (built.category ??= []).push(qb);
          return qb;
        }),
      },
    });
  });

  const repositoryQueries = () =>
    [
      'enrollment',
      'courseTrack',
      'moduleTrack',
      'lessonTrack',
      'certificate',
    ].flatMap((name) => built[name] ?? []);
  const userFilters = (qb: FakeQueryBuilder) =>
    qb.conditions().filter((c) => c.includes('IN (:...userIds)'));

  it('returns the summary counts and category stats as numbers', async () => {
    const result = await service.getCoachProgressDashboard(TENANT, ORG);

    expect(result).toEqual({
      coachesAssigned: 13,
      coursesCompleted: 10,
      modulesCompleted: 14,
      contentCompleted: 30,
      certificatesEarned: 4,
      courses: [
        { categoryId: 'agriculture', completedCount: 2, totalCount: 5 },
      ],
      lessons: [
        { categoryId: 'agriculture', completedCount: 7, totalCount: 9 },
        { categoryId: 'health', completedCount: 0, totalCount: 3 },
      ],
    });
  });

  describe('userIds filter', () => {
    it('applies no user filter when userIds is omitted', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG);
      for (const qb of repositoryQueries()) {
        expect(userFilters(qb)).toEqual([]);
      }
    });

    it('treats an empty userIds array as overall statistics', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG, []);
      for (const qb of repositoryQueries()) {
        expect(userFilters(qb)).toEqual([]);
      }
    });

    it('limits every query, including both category queries, to the given users', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG, ['1001']);

      const expectedColumn: Record<string, string> = {
        enrollment: 'enrollment.userId',
        courseTrack: 'courseTrack.userId',
        moduleTrack: 'moduleTrack.userId',
        lessonTrack: 'lessonTrack.userId',
        certificate: 'enrollment.userId',
      };
      for (const [name, column] of Object.entries(expectedColumn)) {
        expect(built[name].length).toBeGreaterThan(0);
        for (const qb of built[name]) {
          expect(userFilters(qb)).toEqual([`${column} IN (:...userIds)`]);
          expect(qb.params.userIds).toEqual(['1001']);
        }
      }
      // courseTrack: coursesCompleted + courses by category; lessonTrack: content + lessons
      expect(built.courseTrack).toHaveLength(2);
      expect(built.lessonTrack).toHaveLength(2);
      for (const qb of built.category) {
        expect(qb.params.userIds).toEqual(['1001']);
      }
    });

    it('filters on several users and drops duplicate IDs', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG, [
        '1001',
        '1002',
        '1001',
      ]);
      for (const qb of repositoryQueries()) {
        expect(qb.params.userIds).toEqual(['1001', '1002']);
      }
    });
  });

  describe('category aggregation', () => {
    it('counts distinct (user, item) pairs per category, completed via the completed status', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG);

      expect(built.category).toHaveLength(2);
      for (const qb of built.category) {
        const selects = qb.selects();
        const pair = 'CONCAT("tracked"."userId", \':\', "tracked"."itemId")';
        expect(selects).toContain(
          `COUNT(DISTINCT ${pair}) FILTER (WHERE "tracked"."status" = :categoryCompletedStatus)`,
        );
        expect(selects).toContain(`COUNT(DISTINCT ${pair})`);
        expect(qb.params.categoryCompletedStatus).toBe('completed');
        expect(qb.args('groupBy')).toEqual([['"tracked"."categoryId"']]);
        // Every tracked item has a category ("other" at worst), so no row is dropped
        expect(qb.conditions()).toEqual([]);
      }
      expect(built.category[0].args('from')[0][0]).toBe(
        '(SUBQUERY(courseTrack))',
      );
      expect(built.category[1].args('from')[0][0]).toBe(
        '(SUBQUERY(lessonTrack))',
      );
    });

    it('groups courses by courses.categoryIds over course tracking', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG);
      const courseRows = built.courseTrack[1];
      expect(courseRows.args('select')[0]).toEqual([
        'courseTrack.userId',
        'userId',
      ]);
      expect(courseRows.args('addSelect')).toEqual([
        ['courseTrack.courseId', 'itemId'],
        ['courseTrack.status', 'status'],
        [
          "UNNEST(COALESCE(NULLIF(ARRAY_REMOVE(ARRAY_REMOVE(course.categoryIds, NULL), ''), '{}'), ARRAY['other']::varchar[]))",
          'categoryId',
        ],
      ]);
      // All tracked courses, not only completed ones, so totalCount is the tracked total
      expect(courseRows.conditions()).not.toContain(
        'courseTrack.status = :completedStatus',
      );
      expect(courseRows.conditions()).toContain(
        'course.status != :archivedCourseStatus',
      );
    });

    it("groups lessons by their own categoryIds, falling back to the course's", async () => {
      await service.getCoachProgressDashboard(TENANT, ORG);
      const lessonRows = built.lessonTrack[1];
      expect(lessonRows.args('addSelect')).toEqual([
        ['lessonTrack.lessonId', 'itemId'],
        ['lessonTrack.status', 'status'],
        [
          "UNNEST(COALESCE(NULLIF(ARRAY_REMOVE(ARRAY_REMOVE(lesson.categoryIds, NULL), ''), '{}'), NULLIF(ARRAY_REMOVE(ARRAY_REMOVE(course.categoryIds, NULL), ''), '{}'), ARRAY['other']::varchar[]))",
          'categoryId',
        ],
      ]);
      expect(lessonRows.conditions()).not.toContain(
        'lessonTrack.status = :completedStatus',
      );
      expect(lessonRows.conditions()).toContain(
        'lesson.status != :archivedLessonStatus',
      );
    });

    it('scopes tracking rows to the tenant and organisation', async () => {
      await service.getCoachProgressDashboard(TENANT, ORG);
      for (const qb of [built.courseTrack[1], built.lessonTrack[1]]) {
        expect(qb.params).toMatchObject({
          tenantId: TENANT,
          organisationId: ORG,
        });
      }
    });

    it('lists the "other" category (no category assigned) last', async () => {
      categoryRows = [
        [
          { categoryId: 'agriculture', completedCount: '1', totalCount: '2' },
          { categoryId: 'other', completedCount: '0', totalCount: '3' },
          { categoryId: 'zoology', completedCount: '1', totalCount: '1' },
        ],
        [
          { categoryId: 'other', completedCount: '4', totalCount: '6' },
          { categoryId: 'health', completedCount: '1', totalCount: '2' },
        ],
      ];
      const result = await service.getCoachProgressDashboard(TENANT, ORG);
      expect(result.courses.map((c) => c.categoryId)).toEqual([
        'agriculture',
        'zoology',
        'other',
      ]);
      expect(result.lessons).toEqual([
        { categoryId: 'health', completedCount: 1, totalCount: 2 },
        { categoryId: 'other', completedCount: 4, totalCount: 6 },
      ]);
    });

    it('returns empty category lists when nothing is tracked', async () => {
      categoryRows = [[], []];
      const result = await service.getCoachProgressDashboard(TENANT, ORG);
      expect(result.courses).toEqual([]);
      expect(result.lessons).toEqual([]);
    });
  });

  describe('dashboardByUserId category progress', () => {
    it('returns courses and lessons per category for that user only', async () => {
      const result = await service.dashboardByUserId('3129', TENANT, ORG);

      expect(result.courses).toEqual([
        { categoryId: 'agriculture', completedCount: 2, totalCount: 5 },
      ]);
      expect(result.lessons).toEqual([
        { categoryId: 'agriculture', completedCount: 7, totalCount: 9 },
        { categoryId: 'health', completedCount: 0, totalCount: 3 },
      ]);
      // Same per-category rows as the coach dashboard, limited to the user
      const [courseRows] = built.courseTrack.filter((qb) =>
        qb.selects().includes('courseTrack.courseId'),
      );
      const [lessonRows] = built.lessonTrack.filter((qb) =>
        qb.selects().includes('lessonTrack.lessonId'),
      );
      for (const [qb, column] of [
        [courseRows, 'courseTrack.userId'],
        [lessonRows, 'lessonTrack.userId'],
      ] as const) {
        expect(userFilters(qb)).toEqual([`${column} IN (:...userIds)`]);
        expect(qb.params).toMatchObject({
          userIds: ['3129'],
          tenantId: TENANT,
          organisationId: ORG,
        });
      }
      expect(built.category).toHaveLength(2);
    });

    it('no longer returns the old completed-by-category fields', async () => {
      const result = await service.dashboardByUserId('3129', TENANT, ORG);
      expect(result).not.toHaveProperty('completedCoursesByCategory');
      expect(result).not.toHaveProperty('completedStandaloneLessonsByCategory');
    });
  });

  describe('request body (CoachProgressDashboardDto)', () => {
    const errorsFor = async (body: Record<string, unknown>) =>
      (await validate(plainToInstance(CoachProgressDashboardDto, body))).map(
        (e) => e.property,
      );

    it('accepts an empty body, an empty array and string user IDs', async () => {
      expect(await errorsFor({})).toEqual([]);
      expect(await errorsFor({ userIds: [] })).toEqual([]);
      expect(await errorsFor({ userIds: ['1001', '1002'] })).toEqual([]);
    });

    it('rejects a non-array, non-string IDs and empty IDs', async () => {
      expect(await errorsFor({ userIds: '1001' })).toEqual(['userIds']);
      expect(await errorsFor({ userIds: [1001] })).toEqual(['userIds']);
      expect(await errorsFor({ userIds: [''] })).toEqual(['userIds']);
    });
  });
});
