import express from 'express';
import joi from 'joi';
import {
    OrderCreateModel, OrderSearchFilters, OrderStatusUpdateModel,
} from '../../domain.types/orders/order.types';
import { OrderStatus } from '../../domain.types/enums/order.enums';
import { ErrorHandler } from '../../common/api.error';

const lineSchema = joi.object({
    ItemId  : joi.string().uuid().required(),
    Quantity: joi.number().integer().min(1).required(),
    Note    : joi.string().max(255).optional(),
});

export class OrderValidator {

    public static validateCreate = async (request: express.Request): Promise<OrderCreateModel> => {
        try {
            const schema = joi.object({
                CustomerId        : joi.string().uuid().required(),
                ServiceTypeCode   : joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').required(),
                Channel           : joi.string().valid('HomePickup', 'DropAtShop').required(),
                DeliveryType      : joi.string().valid('HomeDelivery', 'CustomerPickup').required(),
                IsExpress         : joi.boolean().default(false),
                BilledTo          : joi.string().valid('Customer', 'Vendor').optional(),
                Items             : joi.array().min(1).items(lineSchema).required(),
                ScheduledAt       : joi.date().iso().optional(),
                DeliveryAddressId : joi.string().uuid().optional(),
                Notes             : joi.string().max(2000).optional(),

                //  Legs. Shape-only checks here; which legs are actually
                //  REQUIRED depends on Channel/DeliveryType and is enforced in
                //  OrderService.assertLegInputs, so the rule lives in one place.
                PickupSlotId      : joi.string().uuid().optional(),
                PickupDate        : joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('PickupDate must be YYYY-MM-DD').optional(),
                DeliverySlotId    : joi.string().uuid().optional(),
                DeliveryDate      : joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('DeliveryDate must be YYYY-MM-DD').optional(),
                SocietyId         : joi.string().uuid().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    /** Filters shared by /orders, /orders/mine and /orders/summary. */
    private static searchSchema = joi.object({
        Status          : joi.string().valid(...Object.values(OrderStatus)).optional(),
        CustomerId      : joi.string().uuid().optional(),
        Query           : joi.string().max(128).allow('').optional(),

        //  Named windows the UI offers instead of two date pickers. Resolved
        //  server-side so "today" means the shop's today, not the phone's.
        Preset          : joi.string().valid('Today', 'Yesterday', 'Week', 'Month', 'Quarter', 'Year', 'All').optional(),
        FromDate        : joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('FromDate must be YYYY-MM-DD').optional(),
        ToDate          : joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('ToDate must be YYYY-MM-DD').optional(),

        ServiceTypeCode : joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').optional(),
        Channel         : joi.string().valid('HomePickup', 'DropAtShop').optional(),
        DeliveryType    : joi.string().valid('HomeDelivery', 'CustomerPickup').optional(),
        BilledTo        : joi.string().valid('Customer', 'Vendor').optional(),
        IsExpress       : joi.boolean().optional(),

        //  Whitelisted: a sort column is a SQL identifier and cannot be
        //  parameterised, so an arbitrary one would be an injection point.
        SortBy          : joi.string().valid('CreatedAt', 'TotalInr', 'OrderCode', 'Status').optional(),
        SortOrder       : joi.string().valid('ASC', 'DESC').optional(),
        PageIndex       : joi.number().integer().min(0).optional(),
        ItemsPerPage    : joi.number().integer().min(1).max(200).optional(),
    //Reject an inverted range rather than silently returning nothing — an
    //empty table reads as "no orders", not "your dates are backwards".
    }).custom((v, helpers) => (v.FromDate && v.ToDate && v.FromDate > v.ToDate
        ? helpers.error('any.invalid', { message: 'FromDate must be on or before ToDate' })
        : v));

    public static validateSearch = async (request: express.Request): Promise<OrderSearchFilters> => {
        try {
            //stripUnknown: the customer app and portal both append UI-only
            //params; rejecting them would be pedantic, and passing them through
            //to the query builder would be worse.
            return await OrderValidator.searchSchema.validateAsync(request.query, { abortEarly: false, stripUnknown: true });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateStatusUpdate = async (request: express.Request): Promise<OrderStatusUpdateModel> => {
        try {
            const schema = joi.object({
                Status: joi.string().valid(...Object.values(OrderStatus)).required(),
                Note  : joi.string().max(255).optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
