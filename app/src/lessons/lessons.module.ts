import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { Lesson } from './entities/lesson.entity';
import { CourseLesson } from './entities/course-lesson.entity';
import { Course } from '../courses/entities/course.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { Media } from '../media/entities/media.entity';
import { AssociatedFile } from '../media/entities/associated-file.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      CourseLesson,
      Course,
      CourseModule,
      Media,
      AssociatedFile,
      LessonTrack,
    ]),
    CommonModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
