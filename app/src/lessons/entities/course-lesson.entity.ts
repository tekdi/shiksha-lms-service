import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Module } from '../../modules/entities/module.entity';
import { Lesson, AttemptsGradeMethod } from './lesson.entity';

export enum CourseLessonStatus {
  UNPUBLISHED = 'unpublished',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('course_lessons')
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  courseLessonId: string;

  @Column({ type: 'uuid' })
  @Index()
  lessonId: string;

  @Column({ type: 'uuid' })
  @Index()
  courseId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  @Column({ type: 'boolean', default: false })
  freeLesson: boolean;

  @Column({ type: 'boolean', default: true })
  considerForPassing: boolean;

  @Column({ 
    type: 'varchar',
    length: 255,
    enum: CourseLessonStatus, 
    default: CourseLessonStatus.UNPUBLISHED 
  })
  status: CourseLessonStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startDatetime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDatetime: Date;

  @Column({ type: 'integer', nullable: true })
  noOfAttempts: number;

  @Column({ 
    type: 'varchar',
    length: 255,
    nullable: true,
    enum: AttemptsGradeMethod
  })
  attemptsGrade: AttemptsGradeMethod;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eligibilityCriteria: string;

  @Column({ type: 'integer', nullable: true })
  idealTime: number;

  @Column({ type: 'boolean', default: false })
  resume: boolean;

  @Column({ type: 'integer', nullable: true })
  totalMarks: number;

  @Column({ type: 'integer', nullable: true })
  passingMarks: number;

  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'uuid' })
  updatedBy: string;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @ManyToOne(() => Module)
  @JoinColumn({ name: 'moduleId' })
  module: Module;

  @ManyToOne(() => Lesson, (lesson) => lesson.courseLessons)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}