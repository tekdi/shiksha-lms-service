import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Course } from '../../courses/entities/course.entity';
import { Lesson } from '../../lessons/entities/lesson.entity';

export enum ModuleStatus {
  ARCHIVED = 'archived',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

@Entity('modules')
export class Module {
  @ApiProperty({ description: 'Unique identifier for the module', example: '123e4567-e89b-12d3-a456-426614174000' })
  @PrimaryGeneratedColumn('uuid')
  moduleId: string;

  @ApiProperty({ description: 'ID of parent module (if this is a submodule)', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId: string;

  @ApiProperty({ description: 'ID of course this module belongs to', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @Column({ type: 'uuid' })
  @Index()
  courseId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy support', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;
  
  @ApiProperty({ description: 'Organization ID for organization-level data isolation', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid'})
  @Index()
  organisationId: string;

  @ApiProperty({ description: 'Module title', example: 'Introduction to Machine Learning Algorithms' })
  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  @ApiProperty({ description: 'Module description', example: 'Learn about different machine learning algorithms', required: false })
  @Column({ type: 'varchar', nullable: true })
  description: string;

  @ApiProperty({ description: 'Module image path', example: 'https://example.com/images/module-image.jpg', required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string;

  @ApiProperty({ description: 'Module start date and time', example: '2023-01-01T00:00:00Z', required: false })
  @Column({ type: 'timestamptz', nullable: true })
  startDatetime: Date;

  @ApiProperty({ description: 'Module end date and time', example: '2023-12-31T23:59:59Z', required: false })
  @Column({ type: 'timestamptz', nullable: true })
  endDatetime: Date;

  @ApiProperty({ 
    description: 'Prerequisites for the module - array of prerequisite module IDs', 
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43c1-b456-426614174000'],
    required: false,
    type: [String],
    isArray: true
  })
  @Column({ type: 'uuid', array: true, nullable: true })
  prerequisites: string[];

  @ApiProperty({ description: 'Badge term', required: false })
  @Column({ type: 'jsonb', nullable: true })
  badgeTerm: Record<string, any>;

  @ApiProperty({ description: 'Badge ID', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @Column({ type: 'uuid', nullable: true })
  badgeId: string;

  @ApiProperty({ description: 'Module order within course or parent module', example: 1 })
  @Column({ type: 'integer', default: 0 })
  ordering: number;

  @ApiProperty({ description: 'Module status', enum: ModuleStatus, example: ModuleStatus.PUBLISHED, default: ModuleStatus.UNPUBLISHED })
  @Column({
    type: 'varchar',
    enum: ModuleStatus,
    default: ModuleStatus.UNPUBLISHED,
  })
  status: ModuleStatus;

  @ApiProperty({ description: 'Creation timestamp', example: '2023-01-01T00:00:00Z' })
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({ description: 'User who created the module', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  createdBy: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2023-01-01T00:00:00Z' })
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ApiProperty({ description: 'User who last updated the module', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  updatedBy: string;

  // Relationships
  @ManyToOne(() => Course, course => course.modules)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @ManyToOne(() => Module, module => module.submodules)
  @JoinColumn({ name: 'parentId' })
  parent: Module;

  @OneToMany(() => Module, module => module.parent)
  submodules: Module[];

  @OneToMany(() => Lesson, lesson => lesson.module)
  lessons: Lesson[];
}