import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEnrollment } from './entities/user-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEnrollment, Course]),
    CommonModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class EnrollmentsModule {} 