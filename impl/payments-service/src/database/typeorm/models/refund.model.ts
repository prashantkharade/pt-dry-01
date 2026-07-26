import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';
import { RefundStatus } from '../../../domain.types/enums/payment.enums';

/////////////////////////////////////////////////////////////////////////
//  One refund attempt against one payment.
//
//  Separate from Payment because refunds are partial and repeatable: a
//  ₹1000 order can be refunded ₹200 now and ₹300 later. The payment's
//  status (PartiallyRefunded / Refunded) is derived from the sum of the
//  processed refunds here.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'refunds' })
@Index('ix_refunds_payment', ['PaymentId'])
//Two clicks of "Refund" must not pay the customer twice.
@Unique('ux_refunds_idempotency', ['PaymentId', 'IdempotencyKey'])
export class Refund {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'PaymentId', type: 'uuid' })
    PaymentId: string;

    @Column({ name: 'OrderId', type: 'uuid' })
    OrderId: string;

    @Column({ name: 'AmountInr', type: 'numeric', precision: 15, scale: 2 })
    AmountInr: string;

    @Column({ name: 'Status', type: 'varchar', length: 16, default: RefundStatus.Pending })
    Status: RefundStatus;

    @Column({ name: 'Reason', type: 'varchar', length: 512 })
    Reason: string;

    //The gateway's id for this refund. Null while pending / for wallet refunds.
    @Column({ name: 'ProviderRefundId', type: 'varchar', length: 128, nullable: true })
    ProviderRefundId: string;

    //True when the money went back to store credit rather than the card.
    //Instant for the customer and costs no gateway fee.
    @Column({ name: 'ToWallet', type: 'boolean', default: false })
    ToWallet: boolean;

    @Column({ name: 'IdempotencyKey', type: 'varchar', length: 128, nullable: true })
    IdempotencyKey: string;

    @Column({ name: 'FailureReason', type: 'varchar', length: 512, nullable: true })
    FailureReason: string;

    @Column({ name: 'RequestedBy', type: 'uuid', nullable: true })
    RequestedBy: string;

    @Column({ name: 'ProcessedAt', type: 'timestamptz', nullable: true })
    ProcessedAt: Date;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
