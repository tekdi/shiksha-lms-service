import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileUploadService } from '../common/utils/local-storage.service';
import { ConfigurationModule } from '../configuration/configuration.module';  
import { TenantModule } from './tenant/tenant.module';
import { CacheModule } from '../cache/cache.module';
@Module({
  imports: [
    ConfigModule,
    ConfigurationModule,
    TenantModule,
    CacheModule,
  ],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class CommonModule {}
