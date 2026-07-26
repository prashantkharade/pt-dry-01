import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  Which zones a partner covers, and when.
//
//  Date-bounded rather than a plain flag so coverage can be planned ahead
//  and history survives — "who was covering Aundh on the 14th?" is a
//  question ops actually asks when an order goes missing.
/////////////////////////////////////////////////////////////////////////

@Entity({ name: 'partner_zone_assignments' })
@Index('ix_partner_zone_assignments_zone', ['ZoneId'])
@Index('ix_partner_zone_assignments_partner', ['PartnerId'])
export class PartnerZoneAssignment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'TenantId', type: 'uuid' })
    TenantId: string;

    @Column({ name: 'PartnerId', type: 'uuid' })
    PartnerId: string;

    @Column({ name: 'ZoneId', type: 'uuid' })
    ZoneId: string;

    //Lower number wins when several partners cover the same zone.
    @Column({ name: 'Priority', type: 'int', default: 0 })
    Priority: number;

    @Column({ name: 'StartDate', type: 'date' })
    StartDate: string;

    //NULL = open-ended.
    @Column({ name: 'EndDate', type: 'date', nullable: true })
    EndDate: string;

    @Column({ name: 'Notes', type: 'text', nullable: true })
    Notes: string;

    @Column({ name: 'IsActive', type: 'boolean', default: true })
    IsActive: boolean;

    @CreateDateColumn({ name: 'CreatedAt' })
    CreatedAt: Date;

    @UpdateDateColumn({ name: 'UpdatedAt' })
    UpdatedAt: Date;
}
