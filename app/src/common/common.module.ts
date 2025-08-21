import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationModule } from '../configuration/configuration.module';  
import { TenantModule } from './tenant/tenant.module';
import { OrderingService } from './services/ordering.service';
import { Course } from '../courses/entities/course.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { Lesson } from '../lessons/entities/lesson.entity';

@Module({
  imports: [
    ConfigModule,
    ConfigurationModule,
    TenantModule,
    TypeOrmModule.forFeature([Course, ModuleEntity, Lesson]),
  ],
  providers: [OrderingService],
  exports: [OrderingService],
})
export class CommonModule {}
