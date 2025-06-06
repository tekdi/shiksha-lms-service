import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModulesModule } from './modules/modules.module';
import { LessonsModule } from './lessons/lessons.module';
import { MediaModule } from './media/media.module';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './common/database.module';
import { CoursesModule } from './courses/courses.module';
import { AppService } from './app.service';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { HealthModule } from './health/health.module';
import { CacheModule } from './cache/cache.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    CacheModule,
    DatabaseModule,
    // Common module
    CommonModule,    
    // Feature modules
    CoursesModule,
    ModulesModule,
    LessonsModule,
    MediaModule,
    EnrollmentsModule,
    HealthModule,
    TrackingModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule{}