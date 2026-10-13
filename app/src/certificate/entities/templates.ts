import {
    Entity,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    PrimaryColumn,
  } from 'typeorm';
  
  @Entity({ name: 'templates' })
  export class Templates {
    @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
    templatesId: string;
  
  @Column({ type: 'varchar' })
  templateId: string;

  @Column({ type: 'varchar', nullable: true })
  template_type: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;
  
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