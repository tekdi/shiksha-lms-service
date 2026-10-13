import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'user_certificates' })
export class UserCourseCertificate {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  usercertificateId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  contextId: string;

  @Column({ type: 'varchar' })
  contextType: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar' })
  certificateId: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  issuedOn: Date;

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

  @Column({ type: 'text', nullable: true })
  createdBy: string;

  @Column({ type: 'text', nullable: true })
  updatedBy: string;

  @Column({ type: 'varchar', nullable: true })
  certificate_type: string | null;

  @Column({ type: 'text', nullable: true, name: 'certificateurl' })
  certificateUrl: string | null;
}
