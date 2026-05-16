import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, Unique,
} from 'typeorm';

@Entity({ name: 'branches' })
@Unique('ux_branches_tenant_code', ['TenantId', 'Code'])
export class Branch {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'Code', type: 'varchar', length: 32 }) Code!: string;
  @Column({ name: 'Name', type: 'varchar', length: 255 }) Name!: string;
  @Column({ name: 'AddressLine', type: 'varchar', length: 512, nullable: true }) AddressLine?: string;
  @Column({ name: 'City', type: 'varchar', length: 128, nullable: true }) City?: string;
  @Column({ name: 'State', type: 'varchar', length: 128, nullable: true }) State?: string;
  @Column({ name: 'Pincode', type: 'varchar', length: 10, nullable: true }) Pincode?: string;
  @Column({ name: 'Phone', type: 'varchar', length: 20, nullable: true }) Phone?: string;
  @Column({ name: 'Email', type: 'varchar', length: 255, nullable: true }) Email?: string;
  @Column({ name: 'IsActive', type: 'boolean', default: true }) IsActive!: boolean;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @DeleteDateColumn({ name: 'DeletedAt' }) DeletedAt?: Date;
}
