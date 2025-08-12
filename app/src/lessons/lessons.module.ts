import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { Lesson } from './entities/lesson.entity';
import { Course } from '../courses/entities/course.entity';
import { Module as CourseModule } from '../modules/entities/module.entity';
import { Media } from '../media/entities/media.entity';
import { AssociatedFile } from '../media/entities/associated-file.entity';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { UserEnrollment } from '../enrollments/entities/user-enrollment.entity';
import { CommonModule } from '../common/common.module';
import { CacheModule } from '../cache/cache.module';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      Course,
      CourseModule,
      Media,
      AssociatedFile,
      LessonTrack,
      UserEnrollment,
    ]),
    CommonModule,
    CacheModule,
    forwardRef(() => ElasticsearchModule),
  ],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
