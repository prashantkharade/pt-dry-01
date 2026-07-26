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

    //Who is paying. Needed to find their wallet without a round trip to orders.
    @Column({ name: 'CustomerId', type: 'uuid', nullable: true })
    CustomerId: string;

    //Contact + language, captured at initiate time. Stored on the payment so a
    //webhook — which arrives with no user and no order context — can send the
    //"payment received" receipt without a round trip to another service.
    @Column({ name: 'CustomerPhone', type: 'varchar', length: 20, nullable: true })
    CustomerPhone: string;

    @Column({ name: 'CustomerLanguage', type: 'varchar', length: 2, nullable: true })
    CustomerLanguage: string;

    @Column({ name: 'Provider', type: 'varchar', length: 32 }) // Razorpay | Zohopay | Cash | Wallet
    Provider: string;

    @Column({ name: 'ProviderOrderId', type: 'varchar', length: 128, nullable: true })
    ProviderOrderId: string;

    @Column({ name: 'ProviderPaymentId', type: 'varchar', length: 128, nullable: true })
    ProviderPaymentId: string;

    //What the GATEWAY is charged. Money is numeric, never float: a float
    //cannot represent 0.10, and the error compounds across a ledger.
    @Column({ name: 'AmountInr', type: 'numeric', precision: 15, scale: 2 })
    AmountInr: string;

    //The store-credit half of a split payment. AmountInr + WalletPaidInr is
    //what this attempt settles in total.
    @Column({ name: 'WalletPaidInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    WalletPaidInr: string;

    @Column({ name: 'Currency', type: 'char', length: 3, default: 'INR' })
    Currency: string;

    //Only ever written by PaymentService.applyStatus, which locks the row and
    //consults the state machine — see payment.state.machine.ts.
    @Column({ name: 'Status', type: 'varchar', length: 32, default: 'Pending' })
    Status: string;

    @Column({ name: 'CapturedAt', type: 'timestamptz', nullable: true })
    CapturedAt: Date;

    @Column({ name: 'FailureReason', type: 'varchar', length: 512, nullable: true })
    FailureReason: string;

    @Column({ name: 'Metadata', type: 'jsonb', nullable: true })
    Metadata: Record<string, unknown>;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
