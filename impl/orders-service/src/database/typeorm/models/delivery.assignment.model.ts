import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DeliveryDirection, AssignmentStatus } from '../../../domain.types/enums/delivery.enums';

/////////////////////////////////////////////////////////////////////////
//  One partner's run: collect from, or return to, one customer for one
//  order. A two-leg order produces two assignments — one Pickup, one
//  Delivery — usually on different dates and often to different partners.
//
//  This is what a partner sees in "My Runs", and the timestamps are stamped
//  as they work: Started (left the hub) -> Arrived (at the door) ->
//  Completed (handed over).
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'delivery_assignments' })
@Index('ix_delivery_assignments_partner_scheduled', ['PartnerId', 'ScheduledAt'])
@Index('ix_delivery_assignments_order', ['OrderId'])
export class DeliveryAssignment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'OrderId', type: 'uuid' })
    OrderId: string;

    @Column({ name: 'PartnerId', type: 'uuid' })
    PartnerId: string;

    //Which leg. The same OrderId legitimately appears twice with different
    //Directions, so nothing here may assume one assignment per order.
    @Column({ name: 'Direction', type: 'varchar', length: 16 })
    Direction: DeliveryDirection;

    @Column({ name: 'SlotBookingId', type: 'uuid', nullable: true })
    SlotBookingId: string;

    @Column({ name: 'Status', type: 'varchar', length: 16, default: AssignmentStatus.Assigned })
    Status: AssignmentStatus;

    @Column({ name: 'ScheduledAt', type: 'timestamptz' })
    ScheduledAt: Date;

    @Column({ name: 'StartedAt', type: 'timestamptz', nullable: true })
    StartedAt: Date;

    @Column({ name: 'ArrivedAt', type: 'timestamptz', nullable: true })
    ArrivedAt: Date;

    @Column({ name: 'CompletedAt', type: 'timestamptz', nullable: true })
    CompletedAt: Date;

    @Column({ name: 'FailedReason', type: 'text', nullable: true })
    FailedReason: string;

    @Column({ name: 'DistanceKm', type: 'numeric', precision: 6, scale: 2, nullable: true })
    DistanceKm: string;

    @Column({ name: 'ChargeApplied', type: 'numeric', precision: 15, scale: 2, nullable: true })
    ChargeApplied: string;

    //Proof of handover — protects against "I never got my clothes back".
    @Column({ name: 'SignatureUrl', type: 'varchar', length: 512, nullable: true })
    SignatureUrl: string;

    @Column({ name: 'PhotoUrl', type: 'varchar', length: 512, nullable: true })
    PhotoUrl: string;

    //How many garments the partner actually collected. Recorded at pickup
    //because the customer's booked count and the real bag rarely match.
    @Column({ name: 'ItemCountCollected', type: 'int', nullable: true })
    ItemCountCollected: number;

    @Column({ name: 'Notes', type: 'text', nullable: true })
    Notes: string;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
