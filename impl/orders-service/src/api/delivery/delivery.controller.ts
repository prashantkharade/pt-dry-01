import express from 'express';
import { container } from 'tsyringe';
import { SlotBookingService } from '../../database/typeorm/services/slot.booking.service';
import { DeliveryAssignmentService } from '../../database/typeorm/services/delivery.assignment.service';
import { DeliveryMasterService } from '../../database/typeorm/services/delivery.master.service';
import { DeliveryChargeService } from '../../database/typeorm/services/delivery.charge.service';
import { DeliveryValidator } from './delivery.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';

export class DeliveryController {

    private _slots       = container.resolve(SlotBookingService);
    private _assignments = container.resolve(DeliveryAssignmentService);
    private _master      = container.resolve(DeliveryMasterService);
    private _charges     = container.resolve(DeliveryChargeService);

    //  --- Slot booking ----------------------------------------------------

    //  GET /delivery/slots/availability?Date=&Direction=
    //  Backs the customer's slot picker: real remaining capacity per window.
    public slotAvailability = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const q = await DeliveryValidator.validateAvailabilityQuery(request);
            const data = await this._slots.availability(request.currentUser.BranchId, q.Date, q.Direction);
            return ResponseHandler.success(request, response, 'OK', 200, data);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  POST /delivery/slots/reserve
    public reserveSlot = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateReserve(request);
            const u = request.currentUser;
            const booking = await this._slots.reserve({
                ...input,
                TenantId : u.TenantId,
                BranchId : u.BranchId,
            });
            return ResponseHandler.created(request, response, 'Slot reserved', booking);
        } catch (error) {
            //A full slot surfaces as 409 from the service — the picker shows
            //"just taken, choose another" rather than a generic failure.
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  DELETE /delivery/slots/bookings/:id
    public releaseSlot = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            await this._slots.release(request.params.id);
            return ResponseHandler.success(request, response, 'Slot released', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  --- Master data -----------------------------------------------------

    public createSlot = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateCreateSlot(request);
            const u = request.currentUser;
            const slot = await this._master.createSlot(u.TenantId, u.BranchId, input);
            return ResponseHandler.created(request, response, 'Slot created', slot);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listSlots = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const slots = await this._master.listSlots(request.currentUser.BranchId);
            return ResponseHandler.success(request, response, 'OK', 200, slots);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public updateSlot = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const slot = await this._master.updateSlot(request.params.id, request.body);
            return ResponseHandler.success(request, response, 'Slot updated', 200, slot);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public createZone = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateCreateZone(request);
            const zone = await this._master.createZone(request.currentUser.TenantId, input);
            return ResponseHandler.created(request, response, 'Zone created', zone);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listZones = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const zones = await this._master.listZones(request.currentUser.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, zones);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public createSociety = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateCreateSociety(request);
            const society = await this._master.createSociety(request.currentUser.TenantId, input);
            return ResponseHandler.created(request, response, 'Society created', society);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listSocieties = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const societies = await this._master.listSocieties(
                request.currentUser.TenantId, request.query.ZoneId as string | undefined);
            return ResponseHandler.success(request, response, 'OK', 200, societies);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public createPartner = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateCreatePartner(request);
            const u = request.currentUser;
            const partner = await this._master.createPartner(u.TenantId, u.BranchId, input);
            return ResponseHandler.created(request, response, 'Partner created', partner);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public listPartners = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const partners = await this._master.listPartners(request.currentUser.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, partners);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public rosterPartner = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateRoster(request);
            const row = await this._master.rosterPartnerOnSlot(request.currentUser.TenantId, input);
            return ResponseHandler.created(request, response, 'Partner rostered', row);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public assignZone = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateZoneCoverage(request);
            const row = await this._master.assignZoneToPartner(request.currentUser.TenantId, input);
            return ResponseHandler.created(request, response, 'Zone coverage added', row);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  --- Assignments -----------------------------------------------------

    //  POST /delivery/auto-assign — pick a partner for one leg automatically.
    //  Ops triggers this from the "needs a partner" queue; the order flow will
    //  call the same service method when a booking is confirmed.
    public autoAssign = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input  = await DeliveryValidator.validateAutoAssign(request);
            const result = await this._assignments.autoAssign({ ...input, TenantId: request.currentUser.TenantId });
            //200 either way: "nobody was eligible" is a real answer with a
            //reason attached, not an error the caller should retry.
            return ResponseHandler.success(
                request, response,
                result.Assigned ? 'Run auto-assigned' : `Not assigned: ${result.Reason}`,
                200, result,
            );
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public assign = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateAssign(request);
            const row = await this._assignments.assignManually(
                request.currentUser.TenantId, input.OrderId, input.Direction, input.PartnerId, input.BookingId);
            return ResponseHandler.created(request, response, 'Run assigned', row);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /delivery/board?Date=&PartnerId=
    public board = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const date = String(request.query.Date ?? new Date().toISOString().slice(0, 10));
            const rows = await this._assignments.listForDate(
                request.currentUser.TenantId, date, request.query.PartnerId as string | undefined);
            return ResponseHandler.success(request, response, 'OK', 200, rows);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /delivery/unassigned?Date= — legs still needing a partner.
    public unassigned = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const date = String(request.query.Date ?? new Date().toISOString().slice(0, 10));
            const rows = await this._assignments.unassignedLegs(request.currentUser.TenantId, date);
            return ResponseHandler.success(request, response, 'OK', 200, rows);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /delivery/my-runs?Date= — the partner's own worklist.
    public myRuns = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const date = String(request.query.Date ?? new Date().toISOString().slice(0, 10));
            const rows = await this._assignments.runsForPartnerUser(request.currentUser.UserId, date);
            return ResponseHandler.success(request, response, 'OK', 200, rows);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  PUT /delivery/runs/:id/status
    public transitionRun = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeliveryValidator.validateTransition(request);
            const u     = request.currentUser;
            //Ops roles pass a null actor, which skips the "is this your run"
            //check — a receptionist legitimately closes a run on behalf of a
            //partner whose phone died.
            const isOps = u.Roles.some((r) => r === 'SystemAdmin' || r === 'Receptionist');
            const row = await this._assignments.transition(
                request.params.id, input.Status, isOps ? null : u.UserId, input);
            return ResponseHandler.success(request, response, 'Run updated', 200, row);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /delivery/charge-quote?SocietyId=&ServiceTypeCode=
    public chargeQuote = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const q = await DeliveryValidator.validateChargeQuote(request);
            const quote = await this._charges.quote(request.currentUser.TenantId, q.SocietyId, q.ServiceTypeCode);
            return ResponseHandler.success(request, response, 'OK', 200, quote);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
