import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'order_status_history' })
@Index('ix_order_status_history_order', ['OrderId'])
export class OrderStatusHistory {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'OrderId', type: 'uuid' })
    OrderId: string;

    @Column({ name: 'FromStatus', type: 'varchar', length: 32, nullable: true })
    FromStatus: string;

    @Column({ name: 'ToStatus', type: 'varchar', length: 32 })
    ToStatus: string;

    @Column({ name: 'ChangedBy', type: 'uuid', nullable: true })
    ChangedBy: string;

    @Column({ name: 'ChangedByName', type: 'varchar', length: 255, nullable: true })
    ChangedByName: string;

    @Column({ name: 'Note', type: 'varchar', length: 255, nullable: true })
    Note: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;
}
