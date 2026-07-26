import { injectable, inject } from 'tsyringe';
import { In, IsNull, Not } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { DeliveryAssignment } from '../models/delivery.assignment.model';
import { DeliveryPartner } from '../models/delivery.partner.model';
import { DeliverySlotBooking } from '../models/delivery.slot.booking.model';
import { DeliverySlot } from '../models/delivery.slot.model';
import { PartnerSlotAssignment } from '../models/partner.slot.assignment.model';
import { PartnerZoneAssignment } from '../models/partner.zone.assignment.model';
import { DeliverySociety } from '../models/delivery.society.model';
import { Order } from '../models/order.model';
import { BaseService } from './base.service';
import { ErrorHandler } from '../../../common/api.error';
import { logger } from '../../../logger/logger';
import { NotificationsServiceConnector } from '../../../modules/notifications/notifications.service.connector';
import {
    AssignmentStatus, DeliveryDirection, ASSIGNMENT_STATUS_TRANSITIONS,
} from '../../../domain.types/enums/delivery.enums';

/////////////////////////////////////////////////////////////////////////
//  Partner runs.
//
//  Two responsibilities:
//    1) pick a partner for a leg (auto-assign, with a manual override)
//    2) drive one run through Assigned -> Started -> Arrived -> Completed
//
//  Assignment is per LEG, not per order: an order's pickup and its delivery
//  are separate runs, usually on different days and often different people.
/////////////////////////////////////////////////////////////////////////

export interface AutoAssignInput {
    TenantId  : string;
    OrderId   : string;
    Direction : DeliveryDirection;
    SocietyId : string;
    BookingId : string;
}

export interface AssignmentResult {
    Assigned  : boolean;
    Assignment?: DeliveryAssignment;
    Reason?   : string;
}

@injectable()
export class DeliveryAssignmentService extends BaseService {

    constructor(
        @inject(NotificationsServiceConnector) private _notify: NotificationsServiceConnector,
    ) {
        super();
    }

    private _repo         = Source.getRepository(DeliveryAssignment);
    private _partnerRepo  = Source.getRepository(DeliveryPartner);
    private _bookingRepo  = Source.getRepository(DeliverySlotBooking);
    private _slotRepo     = Source.getRepository(DeliverySlot);
    private _rosterRepo   = Source.getRepository(PartnerSlotAssignment);
    private _zoneAsgRepo  = Source.getRepository(PartnerZoneAssignment);
    private _societyRepo  = Source.getRepository(DeliverySociety);
    private _orderRepo    = Source.getRepository(Order);

    /**
     * Choose a partner for one leg and create the run.
     *
     * Returns a result rather than throwing when nobody is eligible: an order
     * with no available partner is a normal operational state (ops assigns it
     * by hand), not a failure that should roll back the order.
     */
    public autoAssign = async (input: AutoAssignInput): Promise<AssignmentResult> => {
        const existing = await this._repo.findOne({
            where: {
                OrderId   : input.OrderId,
                Direction : input.Direction,
                Status    : Not(In([AssignmentStatus.Cancelled, AssignmentStatus.Failed])),
            },
        });
        if (existing) return { Assigned: true, Assignment: existing, Reason: 'Already assigned' };

        const booking = await this._bookingRepo.findOne({ where: { id: input.BookingId } });
        if (!booking) return { Assigned: false, Reason: 'Slot booking not found' };

        //Society -> zone by FK, not by comparing names as strings.
        const society = await this._societyRepo.findOne({ where: { id: input.SocietyId, IsActive: true } });
        if (!society) return { Assigned: false, Reason: 'Society not found or inactive' };

        const candidates = await this.eligiblePartners(society.ZoneId, booking.SlotId, booking.BookingDate, input.TenantId);
        if (candidates.length === 0) {
            logger.warn(`No eligible partner for order=${input.OrderId} dir=${input.Direction} zone=${society.ZoneId} date=${booking.BookingDate}`);
            return { Assigned: false, Reason: 'No partner covers this zone and slot on that date' };
        }

        const chosen = await this.leastLoaded(candidates, booking.BookingDate);
        if (!chosen) return { Assigned: false, Reason: 'All covering partners are at their daily limit' };

        const slot       = await this._slotRepo.findOne({ where: { id: booking.SlotId } });
        const scheduledAt = this.slotStartOn(slot?.StartTime ?? '09:00:00', booking.BookingDate);

        const assignment = await this._repo.save(this._repo.create({
            TenantId      : input.TenantId,
            OrderId       : input.OrderId,
            PartnerId     : chosen.id,
            Direction     : input.Direction,
            SlotBookingId : booking.id,
            Status        : AssignmentStatus.Assigned,
            ScheduledAt   : scheduledAt,
            DistanceKm    : society.DistanceKm,
        }));

        logger.info(`Auto-assigned ${input.Direction} order=${input.OrderId} -> partner=${chosen.PartnerCode}`);
        return { Assigned: true, Assignment: assignment };
    };

    /**
     * Partners who (a) cover the zone on that date, (b) are rostered on that
     * slot that date, and (c) are active and on shift.
     */
    private eligiblePartners = async (
        zoneId: string, slotId: string, date: string, tenantId: string,
    ): Promise<DeliveryPartner[]> => {
        const zoneCover = await this._zoneAsgRepo
            .createQueryBuilder('z')
            .where('z.ZoneId = :zoneId', { zoneId })
            .andWhere('z.IsActive = true')
            .andWhere('z.StartDate <= :date', { date })
            .andWhere('(z.EndDate IS NULL OR z.EndDate >= :date)', { date })
            .orderBy('z.Priority', 'ASC')
            .getMany();
        if (zoneCover.length === 0) return [];

        const rostered = await this._rosterRepo.find({
            where: {
                SlotId         : slotId,
                AssignmentDate : date,
                IsActive       : true,
                PartnerId      : In(zoneCover.map((z) => z.PartnerId)),
            },
        });
        if (rostered.length === 0) return [];

        //Boolean columns are booleans here. The reference stored these as
        //varchar and had to parse `IsActive?.toLowerCase() === 'true' || === '1'`
        //at every call site.
        const partners = await this._partnerRepo.find({
            where: {
                id          : In(rostered.map((r) => r.PartnerId)),
                TenantId    : tenantId,
                IsActive    : true,
                IsAvailable : true,
            },
        });

        //Preserve zone priority order.
        const priority = new Map(zoneCover.map((z) => [z.PartnerId, z.Priority]));
        return partners.sort((a, b) => (priority.get(a.id) ?? 0) - (priority.get(b.id) ?? 0));
    };

    /** Fewest runs already booked that day wins; skip anyone at their cap. */
    private leastLoaded = async (candidates: DeliveryPartner[], date: string): Promise<DeliveryPartner | null> => {
        const loads = await Promise.all(candidates.map(async (p) => ({
            partner : p,
            load    : await this.runsOn(p.id, date),
        })));

        const withRoom = loads.filter(({ partner, load }) =>
            //0 is documented as "no limit" on the reference and staff expect that.
            partner.MaxDeliveriesPerDay === 0 || load < partner.MaxDeliveriesPerDay);
        if (withRoom.length === 0) return null;

        withRoom.sort((a, b) => a.load - b.load);
        return withRoom[0].partner;
    };

    private runsOn = async (partnerId: string, date: string): Promise<number> => {
        return this._repo
            .createQueryBuilder('a')
            .where('a.PartnerId = :partnerId', { partnerId })
            .andWhere('CAST(a.ScheduledAt AS DATE) = :date', { date })
            .andWhere('a.Status NOT IN (:...dead)', { dead: [AssignmentStatus.Cancelled, AssignmentStatus.Failed] })
            .getCount();
    };

    private slotStartOn = (startTime: string, date: string): Date => {
        const [h, m, s] = String(startTime).split(':').map(Number);
        const d = new Date(`${date}T00:00:00`);
        d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
        return d;
    };

    /** Manual override — ops assigns a specific partner. */
    public assignManually = async (
        tenantId: string, orderId: string, direction: DeliveryDirection,
        partnerId: string, bookingId: string,
    ): Promise<DeliveryAssignment> => {
        const partner = await this._partnerRepo.findOne({ where: { id: partnerId, TenantId: tenantId, IsActive: true } });
        if (!partner) ErrorHandler.throwNotFoundError('Delivery partner not found');

        const booking = await this._bookingRepo.findOne({ where: { id: bookingId } });
        if (!booking) ErrorHandler.throwNotFoundError('Slot booking not found');

        //Supersede any live run for this leg rather than stacking a second one.
        const live = await this._repo.find({
            where: { OrderId: orderId, Direction: direction, Status: Not(In([AssignmentStatus.Cancelled, AssignmentStatus.Completed, AssignmentStatus.Failed])) },
        });
        for (const a of live) a.Status = AssignmentStatus.Cancelled;
        if (live.length) await this._repo.save(live);

        const slot = await this._slotRepo.findOne({ where: { id: booking.SlotId } });
        return this._repo.save(this._repo.create({
            TenantId      : tenantId,
            OrderId       : orderId,
            PartnerId     : partnerId,
            Direction     : direction,
            SlotBookingId : bookingId,
            Status        : AssignmentStatus.Assigned,
            ScheduledAt   : this.slotStartOn(slot?.StartTime ?? '09:00:00', booking.BookingDate),
        }));
    };

    /**
     * Move a run along. Transitions are validated against the state map, so a
     * partner cannot mark a run Completed without having Arrived — which is
     * what makes the proof-of-handover timestamps trustworthy.
     */
    public transition = async (
        assignmentId : string,
        to           : AssignmentStatus,
        actorUserId  : string,
        details?     : { FailedReason?: string; SignatureUrl?: string; PhotoUrl?: string; ItemCountCollected?: number; Notes?: string },
    ): Promise<DeliveryAssignment> => {
        const assignment = await this._repo.findOne({ where: { id: assignmentId } });
        if (!assignment) ErrorHandler.throwNotFoundError('Assignment not found');

        await this.assertActorOwnsRun(assignment, actorUserId);

        const allowed = ASSIGNMENT_STATUS_TRANSITIONS[assignment.Status] ?? [];
        if (!allowed.includes(to)) {
            ErrorHandler.throwUnprocessableError(
                `Cannot move a run from ${assignment.Status} to ${to}`,
                { From: assignment.Status, To: to, Allowed: allowed },
            );
        }

        if (to === AssignmentStatus.Failed && !details?.FailedReason) {
            //A failed run without a reason is useless to whoever retries it.
            ErrorHandler.throwInputValidationError(['FailedReason is required when failing a run']);
        }

        assignment.Status = to;
        const now = new Date();
        if (to === AssignmentStatus.Started)   assignment.StartedAt   = now;
        if (to === AssignmentStatus.Arrived)   assignment.ArrivedAt   = now;
        if (to === AssignmentStatus.Completed) assignment.CompletedAt = now;
        if (to === AssignmentStatus.Failed)    assignment.FailedReason = details.FailedReason;

        if (details?.SignatureUrl)       assignment.SignatureUrl       = details.SignatureUrl;
        if (details?.PhotoUrl)           assignment.PhotoUrl           = details.PhotoUrl;
        if (details?.ItemCountCollected != null) assignment.ItemCountCollected = details.ItemCountCollected;
        if (details?.Notes)              assignment.Notes              = details.Notes;

        const saved = await this._repo.save(assignment);

        if (to === AssignmentStatus.Completed) {
            //Counter is for display/ranking only — never used as capacity.
            await this._partnerRepo.increment({ id: assignment.PartnerId }, 'TotalDeliveries', 1);
        }
        logger.info(`Assignment ${assignmentId} ${assignment.Direction} -> ${to}`);

        //Tell the customer, with the partner's name and number — this is the
        //richest "someone is coming" signal, which the order-status event
        //(no partner detail) can't match.
        void this.announceRun(saved);
        return saved;
    };

    /**
     * Notify the customer about a run's new state.
     *
     * Started  -> "your partner is on the way" (PICKUP_ON_THE_WAY / OUT_FOR_DELIVERY)
     * Failed   -> "we couldn't reach you, we'll retry" (DELIVERY_FAILED)
     * Other transitions are internal and not worth a buzz.
     *
     * Fire-and-forget: a missed notification must never fail the run update.
     */
    private announceRun = async (run: DeliveryAssignment): Promise<void> => {
        const code =
            run.Status === AssignmentStatus.Started
                ? (run.Direction === DeliveryDirection.Pickup ? 'PICKUP_ON_THE_WAY' : 'OUT_FOR_DELIVERY')
                : run.Status === AssignmentStatus.Failed
                    ? 'DELIVERY_FAILED'
                    : null;
        if (!code) return;

        const order = await this._orderRepo.findOne({ where: { id: run.OrderId } });
        if (!order?.CustomerPhone) return;
        const partner = await this._partnerRepo.findOne({ where: { id: run.PartnerId } });

        //Only include variables the chosen template actually uses — the
        //notification validator rejects an empty variable, so passing
        //Reason:'' on a non-failure event 400s the whole send.
        const variables: Record<string, string> = { OrderCode: order.OrderCode };
        if (run.Status === AssignmentStatus.Failed) {
            variables.Reason = run.FailedReason ?? 'Could not complete the run';
        } else {
            variables.PartnerName  = partner?.Name ?? 'Our partner';
            variables.PartnerPhone = partner?.Phone ?? '';
        }

        await this._notify.fanOut(
            { TenantId: run.TenantId, Code: code, Recipient: order.CustomerPhone, Variables: variables },
            ['SMS', 'Push'],
        );
    };

    /**
     * A partner may only touch their own runs. Checked in the service so it
     * cannot be skipped by a future caller; SystemAdmin/Receptionist bypass is
     * handled by the caller passing a null actor.
     */
    private assertActorOwnsRun = async (assignment: DeliveryAssignment, actorUserId: string): Promise<void> => {
        if (!actorUserId) return;
        const partner = await this._partnerRepo.findOne({ where: { id: assignment.PartnerId } });
        if (!partner || partner.UserId !== actorUserId) {
            ErrorHandler.throwForbiddenError('This run is not assigned to you');
        }
    };

    /** The partner's own worklist for a date — backs "My Runs". */
    public runsForPartnerUser = async (userId: string, date: string): Promise<DeliveryAssignment[]> => {
        const partner = await this._partnerRepo.findOne({ where: { UserId: userId, IsActive: true } });
        if (!partner) ErrorHandler.throwNotFoundError('No delivery partner profile for this user');
        return this._repo
            .createQueryBuilder('a')
            .where('a.PartnerId = :pid', { pid: partner.id })
            .andWhere('CAST(a.ScheduledAt AS DATE) = :date', { date })
            .andWhere('a.Status != :cancelled', { cancelled: AssignmentStatus.Cancelled })
            .orderBy('a.ScheduledAt', 'ASC')
            .getMany();
    };

    public listForOrder = async (orderId: string): Promise<DeliveryAssignment[]> => {
        return this._repo.find({ where: { OrderId: orderId }, order: { ScheduledAt: 'ASC' } });
    };

    /** Ops board: everything scheduled on a date, optionally one partner. */
    public listForDate = async (tenantId: string, date: string, partnerId?: string): Promise<DeliveryAssignment[]> => {
        const qb = this._repo.createQueryBuilder('a')
            .where('a.TenantId = :tenantId', { tenantId })
            .andWhere('CAST(a.ScheduledAt AS DATE) = :date', { date });
        if (partnerId) qb.andWhere('a.PartnerId = :partnerId', { partnerId });
        return qb.orderBy('a.ScheduledAt', 'ASC').getMany();
    };

    public unassignedLegs = async (tenantId: string, date: string): Promise<DeliverySlotBooking[]> => {
        //Live bookings on the date with no run attached — the ops "needs a
        //partner" queue.
        const bookings = await this._bookingRepo.find({
            where: { TenantId: tenantId, BookingDate: date, ReleasedAt: IsNull(), OrderId: Not(IsNull()) },
        });
        if (bookings.length === 0) return [];
        const assigned = await this._repo.find({
            where: { SlotBookingId: In(bookings.map((b) => b.id)), Status: Not(In([AssignmentStatus.Cancelled, AssignmentStatus.Failed])) },
        });
        const taken = new Set(assigned.map((a) => a.SlotBookingId));
        return bookings.filter((b) => !taken.has(b.id));
    };
}
