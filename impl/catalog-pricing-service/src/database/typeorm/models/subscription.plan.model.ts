import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  Subscription plans (BRIEF §2.4) — Monthly / Quarterly / Half-yearly /
//  Yearly. Customer and Vendor variants priced differently.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'subscription_plans' })
@Index('ix_subscription_plans_tenant', ['TenantId'])
export class SubscriptionPlan {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'Code', type: 'varchar', length: 64 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 128 })
    Name: string;

    @Column({ name: 'Duration', type: 'varchar', length: 16 }) // Monthly | Quarterly | HalfYearly | Yearly
    Duration: string;

    @Column({ name: 'PlanType', type: 'varchar', length: 16, default: 'Customer' }) // Customer | Vendor
    PlanType: string;

    @Column({ name: 'DiscountPct', type: 'numeric', precision: 5, scale: 2, default: 0 })
    DiscountPct: string;

    @Column({ name: 'FreePickupsPerMonth', type: 'int', default: 0 })
    FreePickupsPerMonth: number;

    @Column({ name: 'PriceInr', type: 'numeric', precision: 15, scale: 2, default: 0 })
    PriceInr: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
