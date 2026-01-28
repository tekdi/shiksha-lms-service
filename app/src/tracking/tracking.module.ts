import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseTrack } from './entities/course-track.entity';
import { LessonTrack } from './entities/lesson-track.entity';
import { ModuleTrack } from './entities/module-track.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { LessonsModule } from '../lessons/lessons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseTrack, 
      LessonTrack,
      ModuleTrack,
      Course, 
      Lesson, 
      CourseModule
    ]),
    LessonsModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}