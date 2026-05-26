import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';

export class PaymentValidator {

    public static validateInitiate = async (request: express.Request) => {
        try {
            const schema = joi.object({
                OrderId   : joi.string().uuid().required(),
                OrderCode : joi.string().max(32).required(),
                AmountInr : joi.number().min(1).required(),
                Provider  : joi.string().valid('Razorpay', 'Zohopay').optional(),
                Metadata  : joi.object().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateMarkCash = async (request: express.Request) => {
        try {
            const schema = joi.object({
                OrderId   : joi.string().uuid().required(),
                OrderCode : joi.string().max(32).required(),
                AmountInr : joi.number().min(1).required(),
                Provider  : joi.string().valid('Cash', 'UPI').required(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
