import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CourseTrack, TrackingStatus } from './course-track.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Lesson } from '../../lessons/entities/lesson.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('lesson_track')
@Index(['userId', 'lessonId', 'courseId', 'attempt'], { unique: true })
export class LessonTrack {
  @PrimaryGeneratedColumn('uuid', { name: 'lessontrackid' })
  lessonTrackId: string;

  @Column({ type: 'uuid' })
  @Index()
  lessonId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  courseId: string | null;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  @Column({ type: 'int', default: 1 })
  attempt: number;

  @Column({ type: 'timestamptz', nullable: true })
  startDatetime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDatetime: Date;

  @Column({ type: 'int', nullable: true, default: 0 })
  score: number;

  @Column({
    type: 'varchar',
    length: 255,
    enum: TrackingStatus,
    default: TrackingStatus.STARTED,
  })
  status: TrackingStatus;

  @Column({ type: 'float', default: 0 })
  totalContent: number;

  @Column({ type: 'float', default: 0 })
  currentPosition: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  timeSpent: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  completionPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'timestamptz' })
  @UpdateDateColumn()
  updatedAt: Date;

  // Relationship with Lesson
  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lessonId', referencedColumnName: 'lessonId' })
  lesson: Lesson;

  // Relationship with Course
  @ManyToOne(() => Course)
  @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
  course: Course;
}
