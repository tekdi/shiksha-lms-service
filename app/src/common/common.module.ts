import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileUploadService } from '../storage/providers/local-storage.service';
import { ConfigurationModule } from '../configuration/configuration.module';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [
    ConfigModule,
    ConfigurationModule,
    TenantModule,
  ],
  providers: [FileUploadService],
  exports: [FileUploadService],
})
export class CommonModule {}
