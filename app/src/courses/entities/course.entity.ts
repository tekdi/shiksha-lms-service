import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '../../modules/entities/module.entity';
import { UserEnrollment } from '../../enrollments/entities/user-enrollment.entity';
import { LessonTrack } from 'src/tracking/entities/lesson-track.entity';

export enum CourseStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  ARCHIVED = 'archived',
}

@Entity('courses')
export class Course {
  @ApiProperty({ description: 'Unique identifier for the course', example: '123e4567-e89b-12d3-a456-426614174000' })
  @PrimaryGeneratedColumn('uuid')
  courseId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy support', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string;
  
  @ApiProperty({ description: 'Organization ID for organization-level data isolation', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  @ApiProperty({ description: 'Course title', example: 'Introduction to Web Development' })
  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  @ApiProperty({ description: 'Course alias or short name', example: 'intro-web-dev', required: true })
  @Column({ type: 'varchar', length: 255 })
  @Index()
  alias: string;

  @ApiProperty({ description: 'Short description of the course', example: 'A brief intro to web development', required: false })
  @Column({ type: 'varchar', length: 255})
  shortDescription: string;

  @ApiProperty({ description: 'Detailed description of the course', example: 'Learn the fundamentals of web development', required: false })
  @Column({ type: 'text'})
  description: string;

  @ApiProperty({ description: 'Course image path', example: 'https://example.com/images/course-thumb.jpg', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string;

  @ApiProperty({ description: 'Whether the course is featured', example: false, default: false })
  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @ApiProperty({ description: 'Whether the course is free', example: false, default: false })
  @Column({ type: 'boolean', default: false })
  free: boolean;

  @ApiProperty({ description: 'Certificate term', required: false })
  @Column({ type: 'jsonb', nullable: true })
  certificateTerm: Record<string, any>;

  @ApiProperty({ description: 'Certificate ID', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @Column({ type: 'uuid', nullable: true })
  certificateId: string;

  @ApiProperty({ description: 'Course start date and time', example: '2023-01-01T00:00:00Z', required: false })
  @Column({ type: 'timestamptz' })
  startDatetime: Date;

  @ApiProperty({ description: 'Course end date and time', example: '2023-12-31T23:59:59Z', required: false })
  @Column({ type: 'timestamptz' })
  endDatetime: Date;

  @ApiProperty({ description: 'Whether admin approval is required', example: false, default: false })
  @Column({ type: 'boolean', default: false })
  adminApproval: boolean;

  @ApiProperty({ description: 'Whether auto-enrollment is enabled', example: false, default: false })
  @Column({ type: 'boolean', default: false })
  autoEnroll: boolean;

  @ApiProperty({ description: 'Course status', enum: CourseStatus, example: CourseStatus.PUBLISHED, default: CourseStatus.UNPUBLISHED })
  @Column({
    type: 'varchar',
    length: 255,
    enum: CourseStatus,
    default: CourseStatus.UNPUBLISHED,
  })
  status: CourseStatus;

  @ApiProperty({ description: 'Additional parameters', required: false })
  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @ApiProperty({ description: 'User who created the course', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  createdBy: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2023-01-01T00:00:00Z' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'User who last updated the course', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  updatedBy: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2023-01-01T00:00:00Z' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @OneToMany(() => Module, module => module.course)
  modules: Module[];
  
  @OneToMany(() => UserEnrollment, enrollment => enrollment.course)
  enrollments: UserEnrollment[];

  @OneToMany(() => LessonTrack, (track) => track.course)
  lessonTracks: LessonTrack[];
}