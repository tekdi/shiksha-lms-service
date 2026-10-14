import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'course_templates' })
export class CourseTemplate {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  coursetemplateId: string;

  @Column({ type: 'varchar' })
  templateId: string;

  @Column({ type: 'varchar', unique: true })
  contextId: string;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  createdOn: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: false,
  })
  updatedOn: Date;

  @Column({ type: 'varchar' })
  createdBy: string;

  @Column({ type: 'varchar' })
  updatedBy: string;
} 