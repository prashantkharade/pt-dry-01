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
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateSearch = async (request: express.Request): Promise<OrderSearchFilters> => {
        try {
            const schema = joi.object({
                Status       : joi.string().valid(...Object.values(OrderStatus)).optional(),
                CustomerId   : joi.string().uuid().optional(),
                Query        : joi.string().optional(),
                PageIndex    : joi.number().integer().min(0).optional(),
                ItemsPerPage : joi.number().integer().min(1).max(100).optional(),
            });
            return await schema.validateAsync(request.query, { abortEarly: false });
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
