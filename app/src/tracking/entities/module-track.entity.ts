import { ApiProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export enum ModuleTrackStatus {
  INCOMPLETE = 'incomplete',
  COMPLETED = 'completed',
}

@Entity('module_track')
export class ModuleTrack {
  @PrimaryGeneratedColumn('uuid')
  moduleTrackId: string;

  @ApiProperty({ description: 'Tenant ID for multi-tenancy support', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid' })
  @Index()
  tenantId: string;
  
  @ApiProperty({ description: 'Organization ID for organization-level data isolation', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Column({ type: 'uuid'})
  @Index()
  organisationId: string;

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
