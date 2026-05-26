import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';
import { RateCardCreateModel } from '../../domain.types/catalog/catalog.types';

export class RateCardValidator {

    public static validateCreate = async (request: express.Request): Promise<Omit<RateCardCreateModel, 'TenantId'>> => {
        try {
            const schema = joi.object({
                ItemId          : joi.string().uuid().required(),
                ServiceTypeCode : joi.string().valid('DRY_CLEAN', 'LAUNDRY', 'PRESS_ONLY').required(),
                Rate            : joi.number().min(0).required(),
                Uom             : joi.string().max(16).optional(),
                EffectiveFrom   : joi.date().iso().optional(),
                IsVendorRate    : joi.boolean().default(false),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
