import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum ModuleTrackStatus {
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
}

@Entity('module_track')
export class ModuleTrack {
  @PrimaryGeneratedColumn('uuid')
  moduleTrackId: string;

  @Column({ type: 'uuid' })
  @Index()
  moduleId: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ 
    type: 'varchar',
    length: 40, 
    enum: ModuleTrackStatus,
    default: ModuleTrackStatus.INCOMPLETE 
  })
  status: ModuleTrackStatus;

  @Column({ type: 'timestamptz', nullable: true })
  badgeGenDate: Date;
}
