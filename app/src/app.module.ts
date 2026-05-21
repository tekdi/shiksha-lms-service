import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
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
import { CloudStorageModule } from '@tekdi/nestjs-cloud-storage';
import { ConfigurationModule } from './configuration/configuration.module';
import { AspireLeaderModule } from './aspire-leader/aspire-leader.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    // Conditionally import CloudStorageModule if provider is configured
    ...(process.env.CLOUD_STORAGE_PROVIDER
      ? [
          CloudStorageModule.register({
            provider: process.env.CLOUD_STORAGE_PROVIDER as 'aws' | 'azure' | 'gcp',
            region: process.env.CLOUD_STORAGE_REGION,
            credentials: {
              accessKeyId: process.env.CLOUD_STORAGE_ACCESS_KEY_ID,
              secretAccessKey: process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY,
            },
            bucket: process.env.CLOUD_STORAGE_BUCKET_NAME,
          }),
        ]
      : []),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: Number(configService.get('REDIS_PORT', '6379')),
          db: Number(configService.get('REDIS_DB', '0')),
        },
      }),
    }),
    CacheModule,
    DatabaseModule,
    CommonModule,
    ConfigurationModule,
    CoursesModule,
    ModulesModule,
    LessonsModule,
    MediaModule,
    EnrollmentsModule,
    HealthModule,
    TrackingModule,
    AspireLeaderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}