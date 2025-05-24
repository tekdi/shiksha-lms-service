import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';

export enum MediaFormat {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'test',
  EVENT = 'event',
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  mediaId: string;

  @Column({ 
    type: 'varchar',
    enum: MediaFormat 
  })
  format: MediaFormat;

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
}