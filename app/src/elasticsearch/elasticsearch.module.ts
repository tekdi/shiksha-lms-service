import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LMSElasticsearchService } from './lms-elasticsearch.service';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
 
@Module({
  imports: [
    HttpModule, 
    ConfigModule,
    TypeOrmModule.forFeature([LessonTrack, Course, Lesson]),
  ],
  providers: [LMSElasticsearchService],
  exports: [LMSElasticsearchService],
})
export class ElasticsearchModule {} 