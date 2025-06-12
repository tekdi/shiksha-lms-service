import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ConfigController } from './configuration.controller';
import { ConfigurationService } from './configuration.service';
import { TenantModule } from '../common/tenant/tenant.module';

@Module({
  imports: [
    HttpModule, 
    ConfigModule, 
    TenantModule
  ],
  controllers: [ConfigController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {} 