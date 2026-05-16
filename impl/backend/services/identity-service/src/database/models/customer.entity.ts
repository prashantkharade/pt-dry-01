import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

export type CustomerType = 'Retail' | 'Vendor';

@Entity({ name: 'customers' })
@Index('ix_customers_tenant_branch', ['TenantId', 'BranchId'])
@Index('ix_customers_type', ['CustomerType'])
export class Customer {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'BranchId', type: 'uuid' }) BranchId!: string;
  @Column({ name: 'UserId', type: 'uuid', nullable: true }) UserId?: string;
  @Column({ name: 'CustomerCode', type: 'varchar', length: 32 }) CustomerCode!: string;
  @Column({ name: 'CustomerType', type: 'varchar', length: 16, default: 'Retail' }) CustomerType!: CustomerType;
  @Column({ name: 'Name', type: 'varchar', length: 255 }) Name!: string;
  @Column({ name: 'BusinessName', type: 'varchar', length: 255, nullable: true }) BusinessName?: string;
  @Column({ name: 'Phone', type: 'varchar', length: 20, nullable: true }) Phone?: string;
  @Column({ name: 'Email', type: 'varchar', length: 255, nullable: true }) Email?: string;
  @Column({ name: 'Gstin', type: 'varchar', length: 15, nullable: true }) Gstin?: string;
  @Column({ name: 'CreditLimit', type: 'numeric', precision: 15, scale: 2, default: 0 }) CreditLimit!: string;
  @Column({ name: 'PaymentTermsDays', type: 'int', default: 0 }) PaymentTermsDays!: number;
  @Column({ name: 'PriceTier', type: 'varchar', length: 32, default: 'Default' }) PriceTier!: string;
  @Column({ name: 'IsBlocked', type: 'boolean', default: false }) IsBlocked!: boolean;
  @CreateDateColumn({ name: 'OnboardedAt' }) OnboardedAt!: Date;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @DeleteDateColumn({ name: 'DeletedAt' }) DeletedAt?: Date;
}
