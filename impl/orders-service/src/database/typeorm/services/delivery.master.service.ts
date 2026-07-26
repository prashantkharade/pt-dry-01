import { injectable } from 'tsyringe';
import { DeepPartial } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { DeliveryZone } from '../models/delivery.zone.model';
import { DeliverySociety } from '../models/delivery.society.model';
import { DeliverySlot } from '../models/delivery.slot.model';
import { DeliveryPartner } from '../models/delivery.partner.model';
import { PartnerSlotAssignment } from '../models/partner.slot.assignment.model';
import { PartnerZoneAssignment } from '../models/partner.zone.assignment.model';
import { DeliverySlotBooking } from '../models/delivery.slot.booking.model';
import { BaseService } from './base.service';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Master data behind the delivery domain: zones, societies, slots,
//  partners, and the two rosters that say who works where and when.
//
//  Plain CRUD — the interesting behaviour lives in SlotBookingService
//  (capacity) and DeliveryAssignmentService (routing).
/////////////////////////////////////////////////////////////////////////

@injectable()
export class DeliveryMasterService extends BaseService {

    private _zoneRepo    = Source.getRepository(DeliveryZone);
    private _societyRepo = Source.getRepository(DeliverySociety);
    private _slotRepo    = Source.getRepository(DeliverySlot);
    private _partnerRepo = Source.getRepository(DeliveryPartner);
    private _rosterRepo  = Source.getRepository(PartnerSlotAssignment);
    private _zoneAsgRepo = Source.getRepository(PartnerZoneAssignment);
    private _bookingRepo = Source.getRepository(DeliverySlotBooking);

    //  --- Zones -----------------------------------------------------------

    public createZone = async (tenantId: string, input: DeepPartial<DeliveryZone>): Promise<DeliveryZone> => {
        const dup = await this._zoneRepo.findOne({ where: { TenantId: tenantId, Code: input.Code } });
        if (dup) ErrorHandler.throwConflictError(`Zone code ${input.Code} already exists`, { id: dup.id });
        return this._zoneRepo.save(this._zoneRepo.create({ ...input, TenantId: tenantId }));
    };

    public listZones = async (tenantId: string): Promise<DeliveryZone[]> =>
        this._zoneRepo.find({ where: { TenantId: tenantId }, order: { Code: 'ASC' } });

    //  --- Societies -------------------------------------------------------

    public createSociety = async (tenantId: string, input: DeepPartial<DeliverySociety>): Promise<DeliverySociety> => {
        const zone = await this._zoneRepo.findOne({ where: { id: input.ZoneId, TenantId: tenantId } });
        if (!zone) ErrorHandler.throwNotFoundError('Zone not found');
        return this._societyRepo.save(this._societyRepo.create({ ...input, TenantId: tenantId }));
    };

    public listSocieties = async (tenantId: string, zoneId?: string): Promise<DeliverySociety[]> =>
        this._societyRepo.find({
            where : zoneId ? { TenantId: tenantId, ZoneId: zoneId } : { TenantId: tenantId },
            order : { Name: 'ASC' },
        });

    //  --- Slots -----------------------------------------------------------

    public createSlot = async (tenantId: string, branchId: string, input: DeepPartial<DeliverySlot>): Promise<DeliverySlot> =>
        this._slotRepo.save(this._slotRepo.create({ ...input, TenantId: tenantId, BranchId: branchId }));

    public listSlots = async (branchId: string): Promise<DeliverySlot[]> =>
        this._slotRepo.find({ where: { BranchId: branchId }, order: { SortOrder: 'ASC', StartTime: 'ASC' } });

    /**
     * Reducing MaxOrders below what is already booked would put the slot over
     * capacity retroactively. Capacity is only ever enforced at booking time,
     * so nothing else would catch it — reject here.
     */
    public updateSlot = async (id: string, input: DeepPartial<DeliverySlot>): Promise<DeliverySlot> => {
        const slot = await this._slotRepo.findOne({ where: { id } });
        if (!slot) ErrorHandler.throwNotFoundError('Slot not found');

        if (input.MaxOrders != null && input.MaxOrders < slot.MaxOrders) {
            const peak = await this.peakBookedFrom(id, new Date().toISOString().slice(0, 10));
            if (input.MaxOrders < peak) {
                ErrorHandler.throwConflictError(
                    `Cannot reduce capacity to ${input.MaxOrders}: an upcoming date already has ${peak} bookings`,
                    { CurrentPeakBookings: peak },
                );
            }
        }
        Object.assign(slot, input);
        return this._slotRepo.save(slot);
    };

    /** Highest live booking count on any date from `fromDate` onward. */
    private peakBookedFrom = async (slotId: string, fromDate: string): Promise<number> => {
        const rows = await this._bookingRepo
            .createQueryBuilder('b')
            .select('COUNT(*)', 'n')
            .where('b.SlotId = :slotId', { slotId })
            .andWhere('b.BookingDate >= :fromDate', { fromDate })
            .andWhere('b.ReleasedAt IS NULL')
            .groupBy('b.BookingDate')
            .orderBy('n', 'DESC')
            .limit(1)
            .getRawOne<{ n: string }>();
        return Number(rows?.n ?? 0);
    };

    //  --- Partners --------------------------------------------------------

    public createPartner = async (tenantId: string, branchId: string, input: DeepPartial<DeliveryPartner>): Promise<DeliveryPartner> => {
        const dup = await this._partnerRepo.findOne({ where: { TenantId: tenantId, PartnerCode: input.PartnerCode } });
        if (dup) ErrorHandler.throwConflictError(`Partner code ${input.PartnerCode} already exists`, { id: dup.id });
        return this._partnerRepo.save(this._partnerRepo.create({ ...input, TenantId: tenantId, BranchId: branchId }));
    };

    public listPartners = async (tenantId: string): Promise<DeliveryPartner[]> =>
        this._partnerRepo.find({ where: { TenantId: tenantId }, order: { PartnerCode: 'ASC' } });

    public setPartnerAvailability = async (id: string, isAvailable: boolean): Promise<DeliveryPartner> => {
        const partner = await this._partnerRepo.findOne({ where: { id } });
        if (!partner) ErrorHandler.throwNotFoundError('Partner not found');
        partner.IsAvailable = isAvailable;
        return this._partnerRepo.save(partner);
    };

    //  --- Rosters ---------------------------------------------------------

    public rosterPartnerOnSlot = async (tenantId: string, input: DeepPartial<PartnerSlotAssignment>): Promise<PartnerSlotAssignment> => {
        const existing = await this._rosterRepo.findOne({
            where: { PartnerId: input.PartnerId, SlotId: input.SlotId, AssignmentDate: input.AssignmentDate },
        });
        if (existing) {
            //Re-rostering the same partner/slot/date is an update, not a
            //conflict — ops does this to adjust MaxOrders or reactivate.
            Object.assign(existing, input, { IsActive: true });
            return this._rosterRepo.save(existing);
        }
        return this._rosterRepo.save(this._rosterRepo.create({ ...input, TenantId: tenantId }));
    };

    public assignZoneToPartner = async (tenantId: string, input: DeepPartial<PartnerZoneAssignment>): Promise<PartnerZoneAssignment> =>
        this._zoneAsgRepo.save(this._zoneAsgRepo.create({ ...input, TenantId: tenantId }));

    public listRoster = async (slotId: string, date: string): Promise<PartnerSlotAssignment[]> =>
        this._rosterRepo.find({ where: { SlotId: slotId, AssignmentDate: date, IsActive: true } });
}
