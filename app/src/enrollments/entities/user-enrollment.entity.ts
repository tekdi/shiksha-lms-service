import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';

export enum EnrollmentStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  ARCHIVED = 'archived',
}

@Entity('user_enrollments')
export class UserEnrollment {
  @PrimaryGeneratedColumn('uuid')
  enrollmentId: string;

  @Column({ type: 'uuid'})
  @Index()
  courseId: string;

  @Column({ type: 'uuid'})
  @Index()
  tenantId: string;
  
  @Column({ type: 'uuid',nullable: true })
  @Index()
  organisationId: string;

  @Column({ type: 'uuid'})
  @Index()
  userId: string;

  @Column({ type: 'timestamptz', nullable: true })
  enrolledOnTime: Date;

  @Column({ type: 'timestamptz', nullable: true})
  endTime: Date;

  @Column({ 
    type: 'varchar',
    length: 255,
    enum: EnrollmentStatus, 
    default: EnrollmentStatus.PUBLISHED 
  })
  status: EnrollmentStatus;

  @Column({ type: 'boolean', default: false})
  unlimitedPlan: boolean;
  
  @Column({ type: 'boolean', default: false,})
  beforeExpiryMail: boolean;
  
  @Column({ type: 'boolean', default: false, })
  afterExpiryMail: boolean;
  
  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @Column({ type: 'uuid', })
  enrolledBy: string;
  
  @Column({ type: 'timestamptz', })
  @CreateDateColumn()
  enrolledAt: Date;

  @ManyToOne(() => Course, (course) => course.enrollments)
  @JoinColumn({ name: 'courseId' })
  course: Course;
}