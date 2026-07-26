import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  A customer's stored value.
//
//  BalanceInr is a cached total, NOT the source of truth — wallet_transactions
//  is. It exists so a balance read is one row instead of a full ledger scan,
//  and every write to it happens inside the same transaction as the ledger
//  row, under a row lock. reconcile() re-derives it from the ledger.
//
//  MinBalanceInr is the credit floor: 0 for retail, negative for B2B vendors
//  on credit terms (a -20000 floor is a ₹20k credit limit). Modelling credit
//  as a negative floor rather than a second ledger means vendor drawdowns
//  reuse the same audited movement log.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'wallets' })
@Unique('ux_wallets_tenant_customer', ['TenantId', 'CustomerId'])
export class Wallet {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'CustomerId', type: 'uuid' })
    CustomerId: string;

    @Column({ name: 'BalanceInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    BalanceInr: string;

    //Lowest the balance may go. 0 = no credit; negative = B2B credit limit.
    @Column({ name: 'MinBalanceInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    MinBalanceInr: string;

    @Column({ name: 'TotalCreditedInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    TotalCreditedInr: string;

    @Column({ name: 'TotalDebitedInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    TotalDebitedInr: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
