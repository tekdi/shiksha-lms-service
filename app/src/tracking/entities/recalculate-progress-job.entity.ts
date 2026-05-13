import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum RecalculateProgressJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('recalculate_progress_jobs')
@Index(['tenantId', 'organisationId', 'createdAt'])
export class RecalculateProgressJob {
  @PrimaryGeneratedColumn('uuid', { name: 'job_id' })
  @ApiProperty({ format: 'uuid' })
  jobId: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', name: 'organisation_id' })
  @Index()
  organisationId: string;

  @Column({ type: 'uuid', name: 'course_id' })
  @Index()
  courseId: string;

  @Column({ type: 'varchar', length: 256, name: 'bull_job_id', nullable: true, unique: true })
  @Index()
  bullJobId: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    enum: RecalculateProgressJobStatus,
    default: RecalculateProgressJobStatus.QUEUED,
  })
  @Index()
  status: RecalculateProgressJobStatus;

  @Column({ type: 'timestamptz', name: 'queued_at' })
  queuedAt: Date;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'jsonb', name: 'result_json', nullable: true })
  resultJson: {
    success?: boolean;
    message?: string;
    courseTrackUpdated?: number;
    moduleTrackUpdated?: number;
  } | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
