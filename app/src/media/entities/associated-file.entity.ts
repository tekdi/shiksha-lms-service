import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('associated_files')
export class AssociatedFile {
  @PrimaryColumn('uuid')
  filesId: string;

  @Column('uuid')
  lessonId: string;

  @Column('uuid')
  mediaId: string;
}
