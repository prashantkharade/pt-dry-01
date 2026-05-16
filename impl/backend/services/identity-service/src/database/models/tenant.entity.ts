import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ name: 'tenants' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'Name', type: 'varchar', length: 255 }) Name!: string;
  @Column({ name: 'LegalName', type: 'varchar', length: 255, nullable: true }) LegalName?: string;
  @Column({ name: 'Gstin', type: 'varchar', length: 15, nullable: true }) Gstin?: string;
  @Column({ name: 'Pan', type: 'varchar', length: 10, nullable: true }) Pan?: string;
  @Column({ name: 'LogoUrl', type: 'varchar', length: 512, nullable: true }) LogoUrl?: string;
  @Column({ name: 'IsActive', type: 'boolean', default: true }) IsActive!: boolean;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @DeleteDateColumn({ name: 'DeletedAt' }) DeletedAt?: Date;
}
