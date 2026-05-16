import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'client_apps' })
export class ClientApp {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'ClientCode', type: 'varchar', length: 64, unique: true }) ClientCode!: string;
  @Column({ name: 'Name', type: 'varchar', length: 128 }) Name!: string;
  @Column({ name: 'ApiKey', type: 'varchar', length: 255 }) ApiKey!: string; // dev: stored as-is. prod: hash.
  @Column({ name: 'IsActive', type: 'boolean', default: true }) IsActive!: boolean;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
}
