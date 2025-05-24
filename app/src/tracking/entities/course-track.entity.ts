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

export enum TrackingStatus {
  STARTED = 'started',
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
}

@Entity('course_track')
@Index(['userId', 'courseId'], { unique: true })
export class CourseTrack {
  @PrimaryGeneratedColumn('uuid')
  courseTrackId: string;

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

  @OneToMany(() => LessonTrack, lessonTrack => lessonTrack.courseTrack)
  lessonTracks: LessonTrack[];
}