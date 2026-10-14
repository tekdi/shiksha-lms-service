import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.contoller';
import { CertificateCronService } from './certificate-cron.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCourseCertificate } from './entities/user_certificates';
import { Templates } from './entities/templates';
import { CourseTemplate } from './entities/course_templates';
import { LoggerService } from 'src/common/logger/logger/logger.service';
import { S3Service } from './s3.service';
import { CoursesModule } from '../courses/courses.module';
import { AspireLeaderModule } from '../aspire-leader/aspire-leader.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserCourseCertificate,
      Templates,
      CourseTemplate,
    ]),
    CoursesModule,
    AspireLeaderModule,
    TrackingModule,
  ],
  controllers: [CertificateController],
  providers: [
    CertificateService,
    CertificateCronService,
    LoggerService,
    S3Service,
  ],
  exports: [CertificateCronService, CertificateService],
})
export class CertificateModule {}

