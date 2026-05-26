import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity({ name: 'surcharge_config' })
@Unique('ux_surcharge_tenant_key', ['TenantId', 'Key'])
export class SurchargeConfig {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'Key', type: 'varchar', length: 64 })
    Key: string;

    @Column({ name: 'Value', type: 'numeric', precision: 15, scale: 4 })
    Value: string;

    @Column({ name: 'Unit', type: 'varchar', length: 16 })
    Unit: string;

    @Column({ name: 'Description', type: 'text', nullable: true })
    Description: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
