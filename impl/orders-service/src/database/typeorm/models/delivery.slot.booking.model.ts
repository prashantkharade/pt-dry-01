import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DeliveryDirection } from '../../../domain.types/enums/delivery.enums';

/////////////////////////////////////////////////////////////////////////
//  One order's claim on one slot, on one date, for one leg.
//
//  This table IS the capacity ledger: the number of live rows for
//  (SlotId, BookingDate) is the booked count. There is no counter to keep
//  in sync, so capacity cannot drift.
//
//  A cancelled booking is released (ReleasedAt stamped), not deleted — the
//  seat goes back to the pool while the history of who held it survives.
//  Every capacity query filters on ReleasedAt IS NULL, which is also why
//  the index below is partial.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_slot_bookings' })
@Index('ix_slot_bookings_slot_date_active', ['SlotId', 'BookingDate'], { where: '"ReleasedAt" IS NULL' })
@Index('ix_slot_bookings_order', ['OrderId'])
export class DeliverySlotBooking {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'BranchId', type: 'uuid' })
    BranchId: string;

    @Column({ name: 'SlotId', type: 'uuid' })
    SlotId: string;

    //Nullable: the seat is reserved while the order is still being built, then
    //attached once the order row exists. A reservation with no OrderId that is
    //never confirmed is swept by releaseStaleReservations().
    @Column({ name: 'OrderId', type: 'uuid', nullable: true })
    OrderId: string;

    @Column({ name: 'BookingDate', type: 'date' })
    BookingDate: string;

    @Column({ name: 'Direction', type: 'varchar', length: 16 })
    Direction: DeliveryDirection;

    @CreateDateColumn({ name: 'ReservedAt' })
    ReservedAt: Date;

    //Set when the booking is tied to a real, saved order.
    @Column({ name: 'ConfirmedAt', type: 'timestamptz', nullable: true })
    ConfirmedAt: Date;

    //Set on cancellation. Non-null => the seat is back in the pool.
    @Column({ name: 'ReleasedAt', type: 'timestamptz', nullable: true })
    ReleasedAt: Date;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
