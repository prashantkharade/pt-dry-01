import express from 'express';
import joi from 'joi';
import { QuoteRequestModel } from '../../domain.types/pricing/pricing.types';
import { ErrorHandler } from '../../common/api.error';

export class PricingValidator {

    public static validateQuote = async (request: express.Request): Promise<Omit<QuoteRequestModel, 'TenantId'>> => {
        try {
            const schema = joi.object({
                ServiceTypeCode : joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').required(),
                DeliveryType    : joi.string().valid('HomeDelivery', 'CustomerPickup').required(),
                IsExpress       : joi.boolean().default(false),
                IsVendor        : joi.boolean().default(false),
                Items           : joi.array().min(1).items(joi.object({
                    ItemId  : joi.string().uuid().required(),
                    Quantity: joi.number().integer().min(1).required(),
                })).required(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
