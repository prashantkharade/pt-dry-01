import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

@Entity({ name: 'customer_addresses' })
@Index('ix_customer_addresses_customer', ['CustomerId'])
export class CustomerAddress {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'CustomerId', type: 'uuid' })
    CustomerId: string;

    @Column({ name: 'Label', type: 'varchar', length: 64, default: 'Home' })
    Label: string;

    @Column({ name: 'RecipientName', type: 'varchar', length: 255, nullable: true })
    RecipientName: string;

    @Column({ name: 'Flat', type: 'varchar', length: 64, nullable: true })
    Flat: string;

    @Column({ name: 'Building', type: 'varchar', length: 255, nullable: true })
    Building: string;

    @Column({ name: 'Society', type: 'varchar', length: 255, nullable: true })
    Society: string;

    @Column({ name: 'Landmark', type: 'varchar', length: 255, nullable: true })
    Landmark: string;

    @Column({ name: 'Area', type: 'varchar', length: 128, nullable: true })
    Area: string;

    @Column({ name: 'City', type: 'varchar', length: 128 })
    City: string;

    @Column({ name: 'State', type: 'varchar', length: 128 })
    State: string;

    @Column({ name: 'Pincode', type: 'varchar', length: 10 })
    Pincode: string;

    @Column({ name: 'Latitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Latitude: string;

    @Column({ name: 'Longitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
    Longitude: string;

    @Column({ name: 'IsDefault', type: 'boolean', default: false })
    IsDefault: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
