import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media } from './entities/media.entity';
import { AssociatedFile } from './entities/associated-file.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { CommonModule } from '../common/common.module';
import { Course } from '../courses/entities/course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Media,
      AssociatedFile,
      Lesson,
      Course,
    ]),
    CommonModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
