import { Entity, PrimaryColumn, Column, Index, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Lesson } from '../../lessons/entities/lesson.entity';
import { Media } from '../../media/entities/media.entity';

@Entity('associated_files')
export class AssociatedFile {
  @PrimaryGeneratedColumn('uuid')
  associatedFilesId: string;

  @Column()
  lessonId: string;

  @Column()
  mediaId: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  tenantId: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  organisationId: string;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Lesson, lesson => lesson.associatedFiles)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;

  @ManyToOne(() => Media)
  @JoinColumn({ name: 'mediaId' })
  media: Media;
}
