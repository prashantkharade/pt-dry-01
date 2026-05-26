import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'payments' })
@Index('ix_payments_order', ['OrderId'])
@Index('ix_payments_tenant_status', ['TenantId', 'Status'])
export class Payment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'OrderId', type: 'uuid' })
    OrderId: string;

    @Column({ name: 'OrderCode', type: 'varchar', length: 32 })
    OrderCode: string;

    @Column({ name: 'Provider', type: 'varchar', length: 32 }) // Razorpay | Zohopay | Cash | UPI
    Provider: string;

    @Column({ name: 'ProviderOrderId', type: 'varchar', length: 128, nullable: true })
    ProviderOrderId: string;

    @Column({ name: 'ProviderPaymentId', type: 'varchar', length: 128, nullable: true })
    ProviderPaymentId: string;

    @Column({ name: 'AmountInr', type: 'numeric', precision: 15, scale: 2 })
    AmountInr: string;

    @Column({ name: 'Currency', type: 'char', length: 3, default: 'INR' })
    Currency: string;

    @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Pending' }) // Pending | Authorized | Captured | Failed | Refunded
    Status: string;

    @Column({ name: 'FailureReason', type: 'varchar', length: 512, nullable: true })
    FailureReason: string;

    @Column({ name: 'Metadata', type: 'jsonb', nullable: true })
    Metadata: Record<string, unknown>;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
