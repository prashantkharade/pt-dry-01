import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique,
} from 'typeorm';
import { WalletTxnType, WalletTxnReason } from '../../../domain.types/enums/payment.enums';

/////////////////////////////////////////////////////////////////////////
//  The wallet ledger — append-only, and the source of truth for a balance.
//
//  Every row carries BalanceBeforeInr/BalanceAfterInr. That redundancy is
//  deliberate: it makes each movement auditable on its own ("this ₹200 debit
//  took them from 500 to 300") and lets reconcile() detect drift without
//  replaying history against a separate expectation.
//
//  Rows are never updated or deleted. A mistake is corrected by an
//  Adjustment in the opposite direction, so the trail of what really
//  happened survives.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'wallet_transactions' })
@Index('ix_wallet_txn_wallet', ['WalletId'])
@Index('ix_wallet_txn_order', ['OrderId'])
//Idempotency: a retried top-up or a duplicate webhook carrying the same
//IdempotencyKey cannot credit the wallet twice. Enforced by the DB, not by a
//check-then-insert, so it holds under concurrency.
@Unique('ux_wallet_txn_idempotency', ['WalletId', 'IdempotencyKey'])
export class WalletTransaction {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'WalletId', type: 'uuid' })
    WalletId: string;

    @Column({ name: 'Type', type: 'varchar', length: 16 })
    Type: WalletTxnType;

    @Column({ name: 'Reason', type: 'varchar', length: 32 })
    Reason: WalletTxnReason;

    //Always positive. Direction is Type, never the sign — a negative Credit is
    //ambiguous and invites double-negation bugs.
    @Column({ name: 'AmountInr', type: 'numeric', precision: 15, scale: 2 })
    AmountInr: string;

    @Column({ name: 'BalanceBeforeInr', type: 'numeric', precision: 15, scale: 2 })
    BalanceBeforeInr: string;

    @Column({ name: 'BalanceAfterInr', type: 'numeric', precision: 15, scale: 2 })
    BalanceAfterInr: string;

    @Column({ name: 'OrderId', type: 'uuid', nullable: true })
    OrderId: string;

    @Column({ name: 'PaymentId', type: 'uuid', nullable: true })
    PaymentId: string;

    //Nullable: only externally-triggered movements need a dedupe key.
    @Column({ name: 'IdempotencyKey', type: 'varchar', length: 128, nullable: true })
    IdempotencyKey: string;

    @Column({ name: 'Description', type: 'varchar', length: 512, nullable: true })
    Description: string;

    @Column({ name: 'CreatedBy', type: 'uuid', nullable: true })
    CreatedBy: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;
}
