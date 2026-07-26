import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  An operational base partners work out of. One today (the Mukundnagar
//  shop); modelled separately so a second branch does not need a migration.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_hubs' })
@Unique('ux_delivery_hubs_tenant_code', ['TenantId', 'Code'])
export class DeliveryHub {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'BranchId', type: 'uuid' })
    BranchId: string;

    @Column({ name: 'Code', type: 'varchar', length: 32 })
    Code: string;

    @Column({ name: 'Name', type: 'varchar', length: 255 })
    Name: string;

    @Column({ name: 'ManagerName', type: 'varchar', length: 255, nullable: true })
    ManagerName: string;

    @Column({ name: 'ManagerPhone', type: 'varchar', length: 20, nullable: true })
    ManagerPhone: string;

    @Column({ name: 'AddressLine', type: 'varchar', length: 512, nullable: true })
    AddressLine: string;

    @Column({ name: 'City', type: 'varchar', length: 128, nullable: true })
    City: string;

    @Column({ name: 'State', type: 'varchar', length: 128, nullable: true })
    State: string;

    @Column({ name: 'Pincode', type: 'varchar', length: 10, nullable: true })
    Pincode: string;

    //Origin point that society DistanceKm values are measured from.
    @Column({ name: 'Latitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Latitude: string;

    @Column({ name: 'Longitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Longitude: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
