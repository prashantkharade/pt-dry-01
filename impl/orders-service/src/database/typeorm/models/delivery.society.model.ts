import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  An apartment complex / residential cluster inside a zone.
//
//  This is the join between a customer's address and a zone. The reference
//  implementation matched addresses to zones by comparing the society NAME
//  as a string, which silently fails on "Green Acres" vs "Green Acres.".
//  Here an address carries SocietyId, so the link is a real FK.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_societies' })
@Index('ix_delivery_societies_zone', ['ZoneId'])
export class DeliverySociety {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'ZoneId', type: 'uuid' })
    ZoneId: string;

    @Column({ name: 'Name', type: 'varchar', length: 255 })
    Name: string;

    @Column({ name: 'Pincode', type: 'varchar', length: 10, nullable: true })
    Pincode: string;

    //numeric, read back as string — see delivery.charge.rate.model for why.
    @Column({ name: 'Latitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Latitude: string;

    @Column({ name: 'Longitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Longitude: string;

    //Distance from the shop/hub, used to pick a delivery_charge_rates bracket.
    //Stored rather than computed per order: the road distance to a society does
    //not change, and recomputing it per order would need a maps API call on the
    //quote path.
    @Column({ name: 'DistanceKm', type: 'numeric', precision: 6, scale: 2, nullable: true })
    DistanceKm: string;

    @Column({ name: 'BuildingCount', type: 'int', default: 0 })
    BuildingCount: number;

    @Column({ name: 'FlatCount', type: 'int', default: 0 })
    FlatCount: number;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
