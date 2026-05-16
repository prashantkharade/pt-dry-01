import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'service_types' })
export class ServiceType {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'Code', type: 'varchar', length: 32, unique: true }) Code!: string;
  @Column({ name: 'Name', type: 'varchar', length: 128 }) Name!: string;
  @Column({ name: 'NameMr', type: 'varchar', length: 128, nullable: true }) NameMr?: string;
  @Column({ name: 'Description', type: 'text', nullable: true }) Description?: string;
  @Column({ name: 'SortOrder', type: 'int', default: 0 }) SortOrder!: number;
  @Column({ name: 'IsActive', type: 'boolean', default: true }) IsActive!: boolean;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
}
