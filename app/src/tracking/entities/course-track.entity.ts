import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { LessonTrack } from './lesson-track.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum TrackingStatus {
  NOT_STARTED = 'not_started',
  STARTED = 'started',
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
  NOT_ELIGIBLE = 'not_eligible',
}

@Entity('course_track')
@Index(['userId', 'courseId'], { unique: true })
export class CourseTrack {
  @PrimaryGeneratedColumn('uuid')
  courseTrackId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy support', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;
  
  @ApiProperty({ description: 'Organization ID for organization-level data isolation', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid'})
  @Index()
  organisationId: string;

  @Column({ type: 'uuid' })
  @Index()
  courseId: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'timestamptz', nullable: true })
  startDatetime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDatetime: Date;

  @Column({ type: 'int', default: 0 })
  noOfLessons: number;

  @Column({ type: 'int', default: 0 })
  completedLessons: number;

  @Column({
    type: 'varchar',
    length: 40,
    enum: TrackingStatus,
    default: TrackingStatus.INCOMPLETE,
  })
  status: TrackingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  certGenDate: Date;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId' })
  course: Course;
}