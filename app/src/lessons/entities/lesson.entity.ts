import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Media } from '../../media/entities/media.entity';
import { LessonTrack } from '../../tracking/entities/lesson-track.entity';
import { AssociatedFile } from 'src/media/entities/associated-file.entity';
import { Course } from '../../courses/entities/course.entity';
import { Module } from '../../modules/entities/module.entity';

export enum LessonFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'test',
  EVENT = 'event',
}
export enum LessonSubFormat {
  YOUTUBE = 'youtube.url',
  PDF = 'pdf',
  QUIZ = 'quiz',
  EVENT = 'event',
  VIDEO = 'video.url',
}

export enum LessonStatus {
  UNPUBLISHED = 'unpublished',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum AttemptsGradeMethod {
  FIRST_ATTEMPT = 'first_attempt',
  LAST_ATTEMPT = 'last_attempt',
  AVERAGE = 'average',
  HIGHEST = 'highest',
}

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  lessonId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string;
  
  @Column({ type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  @Column({ type: 'uuid', nullable: true })
  checkedOut: string;

  @Column({ type: 'timestamptz', nullable: true })
  checkedOutTime: Date;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alias: string;

  @Column({
    type: 'varchar',
    length: 255,
    enum: LessonStatus,
    default: LessonStatus.UNPUBLISHED
  })
  status: LessonStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string;

  @Column({ type: 'timestamptz', nullable: true })
  startDatetime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDatetime: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  storage: string;

  @Column({ type: 'integer', nullable: true })
  noOfAttempts: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    enum: AttemptsGradeMethod
  })
  attemptsGrade: AttemptsGradeMethod;

  @Column({ 
    type: 'varchar',
    length: 255,
    enum: LessonFormat
  })
  format: LessonFormat;

  @Column({ type: 'uuid', nullable: true })
  mediaId: string;

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

  // Course-specific fields
  @Column({ type: 'uuid', nullable: true })
  @Index()
  courseId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  moduleId: string;

  @Column({ type: 'boolean', default: false })
  sampleLesson: boolean;

  @Column({ type: 'boolean', default: true })
  considerForPassing: boolean;

  @Column({ type: 'integer', default: 0 })
  ordering: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'uuid' })
  updatedBy: string;

  // Relationships
  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @ManyToOne(() => Module, { nullable: true })
  @JoinColumn({ name: 'moduleId' })
  module: Module;

  @ManyToOne(() => Media, (media) => media.lessons, { nullable: true })
  @JoinColumn({ name: 'mediaId' })
  media: Media;

  @OneToMany(() => LessonTrack, (track) => track.lessonId)
  tracks: LessonTrack[];

  @OneToMany(() => AssociatedFile, associatedFile => associatedFile.lesson)
  associatedFiles: AssociatedFile[];
}
