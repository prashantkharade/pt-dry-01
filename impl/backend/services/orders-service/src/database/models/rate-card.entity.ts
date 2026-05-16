import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'rate_cards' })
@Index('ix_rate_cards_lookup', ['TenantId', 'ItemId', 'ServiceTypeCode'])
export class RateCard {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'TenantId', type: 'uuid' }) TenantId!: string;
  @Column({ name: 'ItemId', type: 'uuid' }) ItemId!: string;
  @Column({ name: 'ServiceTypeCode', type: 'varchar', length: 32 }) ServiceTypeCode!: string;
  @Column({ name: 'Rate', type: 'numeric', precision: 15, scale: 2 }) Rate!: string;
  @Column({ name: 'Uom', type: 'varchar', length: 16, default: 'piece' }) Uom!: string;
  @Column({ name: 'EffectiveFrom', type: 'date' }) EffectiveFrom!: string;
  @Column({ name: 'EffectiveTo', type: 'date', nullable: true }) EffectiveTo?: string;
  @Column({ name: 'IsVendorRate', type: 'boolean', default: false }) IsVendorRate!: boolean;
  @CreateDateColumn({ name: 'CreatedAt' }) CreatedAt!: Date;
  @UpdateDateColumn({ name: 'UpdatedAt' }) UpdatedAt!: Date;
  @Column({ name: 'UpdatedBy', type: 'uuid', nullable: true }) UpdatedBy?: string;
}
