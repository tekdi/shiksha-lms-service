import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Lesson, LessonFormat } from '../../lessons/entities/lesson.entity';
import { AssociatedFile } from './associated-file.entity';

export enum MediaFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'test',
  EVENT = 'event',
}

export enum MediaStatus {
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  ARCHIVED = 'archived'
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  mediaId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId: string;
  
  @Column({ type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  @Column({ 
    type: 'varchar',
    enum: MediaFormat 
  })
  format: LessonFormat;

  @Column({ type: 'varchar', nullable: true })
  subFormat: string;

  @Column({ type: 'varchar', nullable: true })
  orgFilename: string;

  @Column({ type: 'varchar', nullable: true })
  path: string;

  @Column({ type: 'varchar', nullable: true })
  storage: string;

  @Column({ type: 'text', nullable: true })
  source: string;

  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, any>;

  @Column({ 
    type: 'varchar',
    enum: MediaStatus,
    default: MediaStatus.PUBLISHED
  })
  status: MediaStatus;

  @Column({ type: 'timestamptz' })
  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'timestamptz' })
  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid' })
  updatedBy: string;

  @OneToMany(() => Lesson, (lesson) => lesson.media)
  lessons: Lesson[];

  @OneToMany(() => AssociatedFile, associatedFile => associatedFile.media)
  associatedFiles: AssociatedFile[];
}