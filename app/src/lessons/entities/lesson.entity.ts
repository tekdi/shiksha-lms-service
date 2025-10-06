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
import { AssociatedFile } from '../../media/entities/associated-file.entity';
import { Course } from '../../courses/entities/course.entity';
import { Module } from '../../modules/entities/module.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum LessonFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  ASSESSMENT = 'test',
  EVENT = 'event',
  TEXT_AND_MEDIA = 'text_and_media',
}
export enum LessonSubFormat {
  YOUTUBE = 'youtube.url',
  VIMEO = 'video.url',
  PDF = 'pdf',
  QUIZ = 'quiz',
  ASSESSMENT = 'assessment',
  FEEDBACK = 'feedback',
  REFLECTION_PROMPT = 'reflection.prompt', // PROJECT SECIFIC - ASPRE_LEADER
  EVENT = 'event',
  VIDEO = 'video.url',
  EXTERNAL_URL = 'external.url',
  DISCORD_URL = 'discord.url', // PROJECT SECIFIC - ASPRE_LEADER
  EXTERNAL_ASSESSMENT_URL = 'external.assessment.url', // PROJECT SECIFIC - ASPRE_LEADER
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
  parentId: string | null;

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

  @ApiProperty({ 
    description: 'Allow users to resubmit the same attempt multiple times. When true, users can only have one attempt and can submit it multiple times. This configuration will override resume and noOfAttempts',
    default: false 
  })
  @Column({ type: 'boolean', default: false })
  allowResubmission: boolean;

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

  @Column({ 
    type: 'varchar',
    length: 255,
    enum: LessonSubFormat
  })
  subFormat: LessonSubFormat;

  @Column({ type: 'uuid', nullable: true })
  mediaId: string;

  @ApiProperty({ 
    description: 'Prerequisites for the lesson - array of prerequisite lesson IDs', 
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43c1-b456-426614174000'],
    required: false,
    type: [String],
    isArray: true
  })
  @Column({ type: 'uuid', array: true, nullable: true })
  prerequisites: string[];

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

  // Self-referencing relationships for parent-child lessons
  @ManyToOne(() => Lesson, lesson => lesson.associatedLesson, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parentLesson: Lesson;

  @OneToMany(() => Lesson, lesson => lesson.parentLesson)
  associatedLesson: Lesson[];
}
