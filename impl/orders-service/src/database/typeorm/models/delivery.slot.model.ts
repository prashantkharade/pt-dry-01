import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, Check,
} from 'typeorm';
import { SlotType } from '../../../domain.types/enums/delivery.enums';

/////////////////////////////////////////////////////////////////////////
//  A reusable time window — "Morning 9-12" — not a per-date row.
//
//  Slots are TEMPLATES. The booked count for a given date is derived by
//  counting live rows in delivery_slot_bookings, never stored here.
//
//  That matters: the reference implementation kept a `CurrentOrders` counter
//  on the slot row that nothing ever incremented, so capacity was a number an
//  admin typed in and no booking path enforced. A derived count cannot drift
//  from the bookings it counts.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_slots' })
@Index('ix_delivery_slots_branch', ['BranchId'])
@Check('ck_slot_time', '"StartTime" < "EndTime"')
@Check('ck_slot_max_orders', '"MaxOrders" > 0')
export class DeliverySlot {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'BranchId', type: 'uuid' })
    BranchId: string;

    @Column({ name: 'Name', type: 'varchar', length: 64 })
    Name: string;

    //Marathi label — the app and portal are bilingual (en + mr).
    @Column({ name: 'NameMr', type: 'varchar', length: 64, nullable: true })
    NameMr: string;

    @Column({ name: 'SlotType', type: 'varchar', length: 16, default: SlotType.Both })
    SlotType: SlotType;

    @Column({ name: 'StartTime', type: 'time' })
    StartTime: string;

    @Column({ name: 'EndTime', type: 'time' })
    EndTime: string;

    //How many orders this window can absorb per day. Enforced on booking by a
    //row lock on THIS row — see SlotBookingService.reserve.
    @Column({ name: 'MaxOrders', type: 'int' })
    MaxOrders: number;

    /**
     * Minutes before StartTime after which this slot can no longer be booked
     * for that day. Without it a customer books the 9-12 pickup at 11:55 and
     * no partner can possibly make it.
     */
    @Column({ name: 'CutoffMinutes', type: 'int', default: 60 })
    CutoffMinutes: number;

    @Column({ name: 'SortOrder', type: 'int', default: 0 })
    SortOrder: number;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;

    @DeleteDateColumn({ name: 'DeletedAt' })
    DeletedAt: Date;
}
