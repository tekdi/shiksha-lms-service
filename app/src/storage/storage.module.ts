import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigModule } from '@nestjs/config';
import { StorageController } from './storage.controller';
import { ConfigurationModule } from '../configuration/configuration.module';
import { S3StorageService } from './providers/s3-storage.service';
import { StorageHelper } from './helpers/storage.helper';

@Module({
  imports: [ConfigModule, ConfigurationModule],
  controllers: [StorageController],
  providers: [StorageService, S3StorageService, StorageHelper],
  exports: [StorageService],
})
export class StorageModule {} 