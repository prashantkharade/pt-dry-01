import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';

export class NotificationValidator {

    public static validateSend = async (request: express.Request) => {
        try {
            const schema = joi.object({
                Channel     : joi.string().valid('SMS', 'Email', 'WhatsApp', 'Push', 'InApp').required(),
                Recipient   : joi.string().max(255).required(),
                Subject     : joi.string().max(255).optional(),
                Body        : joi.string().required(),
                TemplateCode: joi.string().max(64).optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
