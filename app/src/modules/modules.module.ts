import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { Module as CourseModule } from './entities/module.entity';
import { Course } from '../courses/entities/course.entity';
import { CourseLesson } from '../lessons/entities/course-lesson.entity';
import { ModuleTrack } from '../tracking/entities/module-track.entity';
import { CommonModule } from '../common/common.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseModule,
      Course,
      CourseLesson,
      ModuleTrack,
    ]),
    CommonModule,
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
