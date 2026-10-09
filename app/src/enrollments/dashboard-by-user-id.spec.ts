import '../lessons/entities/lesson.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { UserEnrollment } from './entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CacheService } from '../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CacheConfigService } from '../cache/cache-config.service';
import { DashboardByUserIdDto } from './dto/dashboard-by-user-id.dto';

describe('dashboardByUserId Endpoint', () => {
  let service: EnrollmentsService;
  let controller: EnrollmentsController;

  const mockUserEnrollmentRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockCourseTrackRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLessonTrackRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockCourseRepo = {};
  const mockModuleRepo = {};
  const mockModuleTrackRepo = {};
  const mockLessonRepo = {};
  const mockCacheService = {};
  const mockConfigService = {};
  const mockDataSource = {};
  const mockCacheConfigService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentsController],
      providers: [
        EnrollmentsService,
        {
          provide: getRepositoryToken(UserEnrollment),
          useValue: mockUserEnrollmentRepo,
        },
        {
          provide: getRepositoryToken(Course),
          useValue: mockCourseRepo,
        },
        {
          provide: getRepositoryToken(CourseTrack),
          useValue: mockCourseTrackRepo,
        },
        {
          provide: getRepositoryToken(CourseModule),
          useValue: mockModuleRepo,
        },
        {
          provide: getRepositoryToken(ModuleTrack),
          useValue: mockModuleTrackRepo,
        },
        {
          provide: getRepositoryToken(LessonTrack),
          useValue: mockLessonTrackRepo,
        },
        {
          provide: getRepositoryToken(Lesson),
          useValue: mockLessonRepo,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CacheConfigService,
          useValue: mockCacheConfigService,
        },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
    controller = module.get<EnrollmentsController>(EnrollmentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EnrollmentsService.dashboardByUserId', () => {
    it('should return aggregated dashboard metrics correctly', async () => {
      // Mock QueryBuilder for userEnrollmentRepo
      const userEnrollmentQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(2), // 1. totalCount = 5, 5. mandatoryDueCount = 2
      };
      mockUserEnrollmentRepo.createQueryBuilder.mockReturnValue(userEnrollmentQb);

      // Mock count for courseTrackRepo
      mockCourseTrackRepo.count
        .mockResolvedValueOnce(5) // 2. trackcompletioncount
        .mockResolvedValueOnce(3) // 3. trackStatusStartedCount
        .mockResolvedValueOnce(4); // 4. certificateCount

      // Mock QueryBuilder for completed courses by category
      const courseTrackQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { categoryId: 'livelihoods', count: '3' },
          { categoryId: 'financial_inclusion', count: '2' },
        ]),
      };
      mockCourseTrackRepo.createQueryBuilder.mockReturnValue(courseTrackQb);

      // Mock QueryBuilder for completed standalone lessons by category
      const lessonTrackQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { categoryId: 'livelihoods', count: '1' },
          { categoryId: 'social_empowerment', count: '1' },
        ]),
      };
      mockLessonTrackRepo.createQueryBuilder.mockReturnValue(lessonTrackQb);

      const result = await service.dashboardByUserId('user-1', 'tenant-1', 'org-1');

      expect(result).toEqual({
        totalCount: 5,
        trackCompletionCount: 5,
        trackStatusStartedCount: 3,
        certificateCount: 4,
        mandatoryDueCount: 2,
        completedCoursesByCategory: [
          { categoryId: 'livelihoods', count: 3 },
          { categoryId: 'financial_inclusion', count: 2 },
        ],
        completedStandaloneLessonsByCategory: [
          { categoryId: 'livelihoods', count: 1 },
          { categoryId: 'social_empowerment', count: 1 },
        ],
      });
    });
  });

  describe('EnrollmentsController.dashboardByUserIdPost & dashboardByUserIdGet', () => {
    it('should invoke service.dashboardByUserId from POST request', async () => {
      const mockResult = {
        totalCount: 1,
        trackCompletionCount: 1,
        trackStatusStartedCount: 0,
        certificateCount: 0,
        mandatoryDueCount: 0,
        completedCoursesByCategory: [],
        completedStandaloneLessonsByCategory: [],
      };
      jest.spyOn(service, 'dashboardByUserId').mockResolvedValue(mockResult);

      const dto: DashboardByUserIdDto = { userId: 'user-123' };
      const res = await controller.dashboardByUserIdPost(dto, { userId: 'user-123' }, { tenantId: 't1', organisationId: 'o1' });

      expect(service.dashboardByUserId).toHaveBeenCalledWith('user-123', 't1', 'o1');
      expect(res).toBe(mockResult);
    });

    it('should invoke service.dashboardByUserId from GET request', async () => {
      const mockResult = {
        totalCount: 1,
        trackCompletionCount: 1,
        trackStatusStartedCount: 0,
        certificateCount: 0,
        mandatoryDueCount: 0,
        completedCoursesByCategory: [],
        completedStandaloneLessonsByCategory: [],
      };
      jest.spyOn(service, 'dashboardByUserId').mockResolvedValue(mockResult);

      const res = await controller.dashboardByUserIdGet('user-123', { userId: 'user-123' }, { tenantId: 't1', organisationId: 'o1' });

      expect(service.dashboardByUserId).toHaveBeenCalledWith('user-123', 't1', 'o1');
      expect(res).toBe(mockResult);
    });
  });
});
