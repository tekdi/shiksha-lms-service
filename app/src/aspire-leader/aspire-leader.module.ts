import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AspireLeaderController } from './aspire-leader.controller';
import { AspireLeaderService } from './aspire-leader.service';
import { TenantModule } from '../common/tenant/tenant.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    ConfigModule,
    TenantModule,
    CacheModule
  ],
  controllers: [AspireLeaderController],
  providers: [AspireLeaderService],
  exports: [AspireLeaderService],
})
export class AspireLeaderModule {} 