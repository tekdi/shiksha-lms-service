import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { Module as CourseModule } from './entities/module.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { CommonModule } from '../common/common.module';
import { CacheModule } from '../cache/cache.module';
import { CourseTrack } from '../tracking/entities/course-track.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseModule,
      Course,
      Lesson,
      ModuleTrack,
      CourseTrack,
      LessonTrack,
    ]),
    CommonModule,
    CacheModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
