import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  Which slot a partner works on a given date — the roster.
//
//  Auto-assign only considers partners rostered on the booking's slot and
//  date, so this is what stops a morning-shift partner being handed an
//  evening run.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'partner_slot_assignments' })
@Unique('ux_partner_slot_assignments', ['PartnerId', 'SlotId', 'AssignmentDate'])
@Index('ix_partner_slot_assignments_lookup', ['SlotId', 'AssignmentDate'])
export class PartnerSlotAssignment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'PartnerId', type: 'uuid' })
    PartnerId: string;

    @Column({ name: 'SlotId', type: 'uuid' })
    SlotId: string;

    @Column({ name: 'AssignmentDate', type: 'date' })
    AssignmentDate: string;

    /**
     * Per-slot cap for this partner on this date. NULL = fall back to the
     * partner's MaxDeliveriesPerDay. Lets ops throttle one partner in one
     * window without touching their daily total.
     */
    @Column({ name: 'MaxOrders', type: 'int', nullable: true })
    MaxOrders: number;

    @Column({ name: 'Instructions', type: 'text', nullable: true })
    Instructions: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
