import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import {
    OrderStatus, OrderChannel, OrderDeliveryType, BilledTo,
} from '../../../domain.types/enums/order.enums';

@Entity({ name: 'orders' })
@Index('ix_orders_tenant_status', ['TenantId', 'Status'])
@Index('ix_orders_customer', ['CustomerId'])
export class Order {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'BranchId', type: 'uuid' })
    BranchId: string;

    @Column({ name: 'OrderCode', type: 'varchar', length: 32, unique: true })
    OrderCode: string;

    @Column({ name: 'CustomerId', type: 'uuid' })
    CustomerId: string;

    @Column({ name: 'CustomerName', type: 'varchar', length: 255 })
    CustomerName: string;

    @Column({ name: 'CustomerPhone', type: 'varchar', length: 20 })
    CustomerPhone: string;

    @Column({ name: 'BilledTo', type: 'varchar', length: 16, default: 'Customer' })
    BilledTo: BilledTo;

    @Column({ name: 'ServiceTypeCode', type: 'varchar', length: 32 })
    ServiceTypeCode: string;

    @Column({ name: 'Channel', type: 'varchar', length: 32, default: 'DropAtShop' })
    Channel: OrderChannel;

    @Column({ name: 'DeliveryType', type: 'varchar', length: 32, default: 'CustomerPickup' })
    DeliveryType: OrderDeliveryType;

    @Column({ name: 'IsExpress', type: 'boolean', default: false })
    IsExpress: boolean;

    @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Booked' })
    Status: OrderStatus;

    @Column({ name: 'ScheduledAt', type: 'timestamptz', nullable: true })
    ScheduledAt: Date;

    @Column({ name: 'DeliveryAddressId', type: 'uuid', nullable: true })
    DeliveryAddressId: string;

    //Which society the address sits in. Resolves the order to a delivery zone
    //(and therefore to the partners who can reach it) by FK rather than by
    //string-matching the society name, which is what the reference did.
    @Column({ name: 'SocietyId', type: 'uuid', nullable: true })
    SocietyId: string;

    //  The two legs. Laundry is collect -> process -> return, so an order can
    //  hold a seat in two different slots on two different dates.
    //  Null is meaningful, and differs per leg:
    //    PickupSlotBookingId   null => Channel is DropAtShop (customer brings it in)
    //    DeliverySlotBookingId null => DeliveryType is CustomerPickup (collects it)
    @Column({ name: 'PickupSlotBookingId', type: 'uuid', nullable: true })
    PickupSlotBookingId: string;

    @Column({ name: 'DeliverySlotBookingId', type: 'uuid', nullable: true })
    DeliverySlotBookingId: string;

    @Column({ name: 'SubtotalInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    SubtotalInr: string;

    @Column({ name: 'DeliveryChargeInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    DeliveryChargeInr: string;

    @Column({ name: 'ExpressChargeInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    ExpressChargeInr: string;

    @Column({ name: 'GstInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    GstInr: string;

    @Column({ name: 'TotalInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    TotalInr: string;

    @Column({ name: 'Notes', type: 'text', nullable: true })
    Notes: string;

    @Column({ name: 'CreatedBy', type: 'uuid', nullable: true })
    CreatedBy: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
