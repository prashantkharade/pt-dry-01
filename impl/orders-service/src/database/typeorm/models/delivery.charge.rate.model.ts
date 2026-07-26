import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, Check,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  Distance-bracket rate table for the delivery charge.
//
//  Effective-dated rather than mutated in place: an order booked last month
//  must still price the way it did then, so raising the rate inserts a new
//  row and closes the old one with EffectiveTo.
//
//  Money is NUMERIC, never float. The reference stored order money in float
//  columns, which cannot represent 0.10 exactly — errors compound across
//  subtotal + delivery + GST and the invoice fails to foot.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_charge_rates' })
@Index('ix_delivery_charge_rates_lookup', ['TenantId', 'ServiceTypeCode', 'MinDistanceKm'])
@Check('ck_charge_rate_distance', '"MaxDistanceKm" > "MinDistanceKm"')
@Check('ck_charge_rate_base', '"BaseCharge" >= 0')
export class DeliveryChargeRate {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    //NULL = applies to every service type. A row naming a service type wins
    //over the catch-all — see DeliveryChargeService.quote.
    @Column({ name: 'ServiceTypeCode', type: 'varchar', length: 32, nullable: true })
    ServiceTypeCode: string;

    @Column({ name: 'MinDistanceKm', type: 'numeric', precision: 6, scale: 2, default: 0 })
    MinDistanceKm: string;

    @Column({ name: 'MaxDistanceKm', type: 'numeric', precision: 6, scale: 2 })
    MaxDistanceKm: string;

    @Column({ name: 'BaseCharge', type: 'numeric', precision: 15, scale: 2 })
    BaseCharge: string;

    //Charged per km beyond MinDistanceKm. 0 => flat BaseCharge for the bracket.
    @Column({ name: 'ChargePerKm', type: 'numeric', precision: 15, scale: 2, default: 0 })
    ChargePerKm: string;

    @Column({ name: 'EffectiveFrom', type: 'date' })
    EffectiveFrom: string;

    @Column({ name: 'EffectiveTo', type: 'date', nullable: true })
    EffectiveTo: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
