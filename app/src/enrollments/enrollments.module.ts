import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { UserEnrollment } from './entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { CacheModule } from '../cache/cache.module';
import { Lesson } from '../lessons/entities/lesson.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEnrollment,
      Course,
      CourseTrack,
      CourseModule,
      ModuleTrack,
      Lesson,
    ]),
    ConfigModule,
    CacheModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
