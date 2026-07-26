import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  A geographic region we serve. Zones are how a customer address is
//  resolved to the partners who can reach it.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_zones' })
@Unique('ux_delivery_zones_tenant_code', ['TenantId', 'Code'])
export class DeliveryZone {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    //Short human key used on labels and in ops chatter: 'MNG', 'AUNDH'.
    @Column({ name: 'Code', type: 'varchar', length: 32 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 128 })
    Name: string;

    @Column({ name: 'NameMr', type: 'varchar', length: 128, nullable: true })
    NameMr: string;

    //Free text — pincodes / area names, for staff reference.
    @Column({ name: 'Coverage', type: 'text', nullable: true })
    Coverage: string;

    //Optional GeoJSON polygon. Not used for routing yet; reserved so zone
    //boundaries can later be drawn on a map without a migration.
    @Column({ name: 'Boundary', type: 'jsonb', nullable: true })
    Boundary: Record<string, unknown>;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
