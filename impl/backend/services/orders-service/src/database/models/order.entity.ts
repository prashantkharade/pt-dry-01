import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

export type OrderStatus =
  | 'Booked' | 'PickedUp' | 'Received' | 'InProcess' | 'Ready'
  | 'OutForDelivery' | 'Delivered' | 'Closed' | 'Cancelled' | 'OnHold';

@Entity({ name: 'orders' })
@Index('ix_orders_tenant_status', ['TenantId', 'Status'])
@Index('ix_orders_customer', ['CustomerId'])
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'BranchId', type: 'uuid' }) BranchId!: string;
  @Column({ name: 'OrderCode', type: 'varchar', length: 32, unique: true }) OrderCode!: string;
  @Column({ name: 'CustomerId', type: 'uuid' }) CustomerId!: string;
  @Column({ name: 'CustomerName', type: 'varchar', length: 255 }) CustomerName!: string;
  @Column({ name: 'CustomerPhone', type: 'varchar', length: 20 }) CustomerPhone!: string;
  @Column({ name: 'BilledTo', type: 'varchar', length: 16, default: 'Customer' }) BilledTo!: 'Customer' | 'Vendor';
  @Column({ name: 'ServiceTypeCode', type: 'varchar', length: 32 }) ServiceTypeCode!: string;
  @Column({ name: 'Channel', type: 'varchar', length: 32, default: 'DropAtShop' }) Channel!: 'HomePickup' | 'DropAtShop';
  @Column({ name: 'DeliveryType', type: 'varchar', length: 32, default: 'CustomerPickup' }) DeliveryType!: 'HomeDelivery' | 'CustomerPickup';
  @Column({ name: 'IsExpress', type: 'boolean', default: false }) IsExpress!: boolean;
  @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Booked' }) Status!: OrderStatus;
  @Column({ name: 'ScheduledAt', type: 'timestamptz', nullable: true }) ScheduledAt?: Date;
  @Column({ name: 'DeliveryAddressId', type: 'uuid', nullable: true }) DeliveryAddressId?: string;

  @Column({ name: 'SubtotalInr', type: 'numeric', precision: 15, scale: 2, default: 0 }) SubtotalInr!: string;
  @Column({ name: 'DeliveryChargeInr', type: 'numeric', precision: 15, scale: 2, default: 0 }) DeliveryChargeInr!: string;
  @Column({ name: 'ExpressChargeInr', type: 'numeric', precision: 15, scale: 2, default: 0 }) ExpressChargeInr!: string;
  @Column({ name: 'GstInr', type: 'numeric', precision: 15, scale: 2, default: 0 }) GstInr!: string;
  @Column({ name: 'TotalInr', type: 'numeric', precision: 15, scale: 2, default: 0 }) TotalInr!: string;

  @Column({ name: 'Notes', type: 'text', nullable: true }) Notes?: string;
  @Column({ name: 'CreatedBy', type: 'uuid', nullable: true }) CreatedBy?: string;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @DeleteDateColumn({ name: 'DeletedAt' }) DeletedAt?: Date;
}
