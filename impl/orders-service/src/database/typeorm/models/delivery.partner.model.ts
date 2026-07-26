import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, Unique,
} from 'typeorm';
import { VehicleType, ShiftPreference } from '../../../domain.types/enums/delivery.enums';

/////////////////////////////////////////////////////////////////////////
//  A delivery agent who collects and returns garments.
//
//  Partners sign in to the admin portal with the DeliveryPartner role and
//  work their own "My Runs" list; UserId is the link to identity-service.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_partners' })
@Unique('ux_delivery_partners_tenant_code', ['TenantId', 'PartnerCode'])
@Index('ix_delivery_partners_user', ['UserId'])
export class DeliveryPartner {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'BranchId', type: 'uuid' })
    BranchId: string;

    @Column({ name: 'HubId', type: 'uuid', nullable: true })
    HubId: string;

    //Cross-service ref into identity-service.users. Nullable so ops can create
    //the partner record before the login exists.
    @Column({ name: 'UserId', type: 'uuid', nullable: true })
    UserId: string;

    @Column({ name: 'PartnerCode', type: 'varchar', length: 32 })
    PartnerCode: string;

    @Column({ name: 'Name', type: 'varchar', length: 255 })
    Name: string;

    @Column({ name: 'Phone', type: 'varchar', length: 20 })
    Phone: string;

    @Column({ name: 'VehicleType', type: 'varchar', length: 32, nullable: true })
    VehicleType: VehicleType;

    @Column({ name: 'VehicleNo', type: 'varchar', length: 32, nullable: true })
    VehicleNo: string;

    @Column({ name: 'LicenseNo', type: 'varchar', length: 32, nullable: true })
    LicenseNo: string;

    @Column({ name: 'LicenseDocumentUrl', type: 'varchar', length: 512, nullable: true })
    LicenseDocumentUrl: string;

    @Column({ name: 'Rating', type: 'numeric', precision: 3, scale: 2, default: 0 })
    Rating: string;

    @Column({ name: 'ShiftPreference', type: 'varchar', length: 32, nullable: true })
    ShiftPreference: ShiftPreference;

    //Load-balancing cap used by auto-assign. Typed int, not a stringly-typed
    //column parsed at the call site as the reference did.
    @Column({ name: 'MaxDeliveriesPerDay', type: 'int', default: 20 })
    MaxDeliveriesPerDay: number;

    @Column({ name: 'TotalDeliveries', type: 'int', default: 0 })
    TotalDeliveries: number;

    //IsAvailable = "on shift right now" (toggled daily).
    //IsActive    = "still employed" (toggled rarely).
    @Column({ name: 'IsAvailable', type: 'boolean', default: true })
    IsAvailable: boolean;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
