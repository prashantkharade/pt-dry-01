import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'order_items' })
@Index('ix_order_items_order', ['OrderId'])
export class OrderItem {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'OrderId', type: 'uuid' })
    OrderId: string;

    @Column({ name: 'ItemId', type: 'uuid' })
    ItemId: string;

    @Column({ name: 'ItemName', type: 'varchar', length: 128 })
    ItemName: string;

    @Column({ name: 'ItemCode', type: 'varchar', length: 64 })
    ItemCode: string;

    @Column({ name: 'ServiceTypeCode', type: 'varchar', length: 32 })
    ServiceTypeCode: string;

    @Column({ name: 'Quantity', type: 'int' })
    Quantity: number;

    @Column({ name: 'UnitRateInr', type: 'numeric', precision: 15, scale: 2 })
    UnitRateInr: string;

    @Column({ name: 'LineTotalInr', type: 'numeric', precision: 15, scale: 2 })
    LineTotalInr: string;

    @Column({ name: 'Note', type: 'varchar', length: 255, nullable: true })
    Note: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;
}
