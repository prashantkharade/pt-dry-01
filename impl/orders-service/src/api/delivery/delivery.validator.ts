import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';
import {
    DeliveryDirection, SlotType, AssignmentStatus, VehicleType, ShiftPreference,
} from '../../domain.types/enums/delivery.enums';

//  ISO date, no time. Slots are booked against a shop day, not an instant.
const DateSchema = joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Date must be YYYY-MM-DD');
const TimeSchema = joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).message('Time must be HH:MM or HH:MM:SS');

export class DeliveryValidator {

    private static run = async <T>(schema: joi.ObjectSchema, payload: unknown): Promise<T> => {
        try {
            return await schema.validateAsync(payload, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateAvailabilityQuery = async (request: express.Request) =>
        DeliveryValidator.run<{ Date: string; Direction: DeliveryDirection }>(joi.object({
            Date      : DateSchema.required(),
            Direction : joi.string().valid(...Object.values(DeliveryDirection)).required(),
        }), request.query);

    public static validateReserve = async (request: express.Request) =>
        DeliveryValidator.run<{ SlotId: string; BookingDate: string; Direction: DeliveryDirection; OrderId?: string }>(joi.object({
            SlotId      : joi.string().uuid().required(),
            BookingDate : DateSchema.required(),
            Direction   : joi.string().valid(...Object.values(DeliveryDirection)).required(),
            OrderId     : joi.string().uuid().optional(),
        }), request.body);

    public static validateCreateSlot = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            Name          : joi.string().max(64).required(),
            NameMr        : joi.string().max(64).optional(),
            SlotType      : joi.string().valid(...Object.values(SlotType)).default(SlotType.Both),
            StartTime     : TimeSchema.required(),
            EndTime       : TimeSchema.required(),
            MaxOrders     : joi.number().integer().min(1).required(),
            CutoffMinutes : joi.number().integer().min(0).max(1440).default(60),
            SortOrder     : joi.number().integer().min(0).default(0),
        //Mirrors the DB CHECK. Rejecting here gives a 400 with a readable
        //message instead of a 500 from a constraint violation.
        }).custom((v, helpers) => (v.StartTime >= v.EndTime
            ? helpers.error('any.invalid', { message: 'StartTime must be before EndTime' })
            : v)), request.body);

    public static validateCreateZone = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            Code     : joi.string().max(32).uppercase().required(),
            Name     : joi.string().max(128).required(),
            NameMr   : joi.string().max(128).optional(),
            Coverage : joi.string().optional(),
        }), request.body);

    public static validateCreateSociety = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            ZoneId        : joi.string().uuid().required(),
            Name          : joi.string().max(255).required(),
            Pincode       : joi.string().length(6).optional(),
            Latitude      : joi.number().min(-90).max(90).optional(),
            Longitude     : joi.number().min(-180).max(180).optional(),
            DistanceKm    : joi.number().min(0).max(999).optional(),
            BuildingCount : joi.number().integer().min(0).default(0),
            FlatCount     : joi.number().integer().min(0).default(0),
        }), request.body);

    public static validateCreatePartner = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            PartnerCode         : joi.string().max(32).required(),
            Name                : joi.string().max(255).required(),
            Phone               : joi.string().pattern(/^\+91[6-9]\d{9}$/).message('Phone must be +91XXXXXXXXXX').required(),
            UserId              : joi.string().uuid().optional(),
            HubId               : joi.string().uuid().optional(),
            VehicleType         : joi.string().valid(...Object.values(VehicleType)).optional(),
            VehicleNo           : joi.string().max(32).optional(),
            LicenseNo           : joi.string().max(32).optional(),
            ShiftPreference     : joi.string().valid(...Object.values(ShiftPreference)).optional(),
            //0 is meaningful: "no daily limit".
            MaxDeliveriesPerDay : joi.number().integer().min(0).max(200).default(20),
        }), request.body);

    public static validateAutoAssign = async (request: express.Request) =>
        DeliveryValidator.run<{ OrderId: string; Direction: DeliveryDirection; SocietyId: string; BookingId: string }>(joi.object({
            OrderId   : joi.string().uuid().required(),
            Direction : joi.string().valid(...Object.values(DeliveryDirection)).required(),
            SocietyId : joi.string().uuid().required(),
            BookingId : joi.string().uuid().required(),
        }), request.body);

    public static validateAssign = async (request: express.Request) =>
        DeliveryValidator.run<{ OrderId: string; Direction: DeliveryDirection; PartnerId: string; BookingId: string }>(joi.object({
            OrderId   : joi.string().uuid().required(),
            Direction : joi.string().valid(...Object.values(DeliveryDirection)).required(),
            PartnerId : joi.string().uuid().required(),
            BookingId : joi.string().uuid().required(),
        }), request.body);

    public static validateTransition = async (request: express.Request) =>
        DeliveryValidator.run<{
            Status: AssignmentStatus; FailedReason?: string; SignatureUrl?: string;
            PhotoUrl?: string; ItemCountCollected?: number; Notes?: string;
        }>(joi.object({
            Status             : joi.string().valid(...Object.values(AssignmentStatus)).required(),
            //Required when failing — enforced again in the service, since the
            //service is reachable from other callers.
            FailedReason       : joi.string().max(500).when('Status', { is: AssignmentStatus.Failed, then: joi.required() }),
            SignatureUrl       : joi.string().uri().max(512).optional(),
            PhotoUrl           : joi.string().uri().max(512).optional(),
            ItemCountCollected : joi.number().integer().min(0).max(999).optional(),
            Notes              : joi.string().max(1000).optional(),
        }), request.body);

    public static validateRoster = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            PartnerId      : joi.string().uuid().required(),
            SlotId         : joi.string().uuid().required(),
            AssignmentDate : DateSchema.required(),
            MaxOrders      : joi.number().integer().min(1).optional(),
            Instructions   : joi.string().max(1000).optional(),
        }), request.body);

    public static validateZoneCoverage = async (request: express.Request) =>
        DeliveryValidator.run<Record<string, unknown>>(joi.object({
            PartnerId : joi.string().uuid().required(),
            ZoneId    : joi.string().uuid().required(),
            Priority  : joi.number().integer().min(0).default(0),
            StartDate : DateSchema.required(),
            EndDate   : DateSchema.optional(),
        }), request.body);

    public static validateChargeQuote = async (request: express.Request) =>
        DeliveryValidator.run<{ SocietyId: string; ServiceTypeCode?: string }>(joi.object({
            SocietyId       : joi.string().uuid().required(),
            ServiceTypeCode : joi.string().max(32).optional(),
        }), request.query);
}
