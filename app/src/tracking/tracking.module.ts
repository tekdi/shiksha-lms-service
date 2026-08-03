import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CourseTrack } from './entities/course-track.entity';
import { LessonTrack } from './entities/lesson-track.entity';
import { ModuleTrack } from './entities/module-track.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { ProgressRecalculationJob } from './entities/progress-recalculation-job.entity';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { RecalculateProgressQueueService } from './recalculate-progress-queue.service';
import { LessonsModule } from '../lessons/lessons.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CacheModule } from '../cache/cache.module';
import { LmsNotificationService } from '../common/services/lms-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseTrack,
      LessonTrack,
      ModuleTrack,
      Course,
      Lesson,
      CourseModule,
      ProgressRecalculationJob,
    ]),
    BullModule.registerQueue({ name: 'recalculate-progress' }),
    forwardRef(() => LessonsModule),
    EnrollmentsModule,
    CacheModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, LmsNotificationService, RecalculateProgressQueueService],
  exports: [TrackingService, RecalculateProgressQueueService],
})
export class TrackingModule {}