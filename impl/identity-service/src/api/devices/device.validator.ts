import express from 'express';
import joi from 'joi';
import { DeviceRegisterModel } from '../../domain.types/users/device.types';
import { ErrorHandler } from '../../common/api.error';

export class DeviceValidator {

    public static validateRegister = async (
        request: express.Request,
    ): Promise<Omit<DeviceRegisterModel, 'UserId' | 'IpAddress' | 'UserAgent'>> => {
        try {
            const schema = joi.object({
                DeviceId   : joi.string().min(4).max(128).required(),
                DeviceName : joi.string().max(255).optional(),
                Platform   : joi.string().valid('Android', 'iOS', 'Web').optional(),
                AppVersion : joi.string().max(32).optional(),
                OsVersion  : joi.string().max(32).optional(),
                //FCM tokens run ~160+ chars today and have grown historically;
                //512 matches the column and leaves headroom.
                FcmToken   : joi.string().max(512).optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validatePushTargets = async (request: express.Request): Promise<{ UserIds: string[] }> => {
        try {
            const schema = joi.object({
                //Bounded: this is a bulk token lookup, and an unbounded list is
                //an easy way to make us load the whole device table into memory.
                UserIds: joi.array().items(joi.string().uuid()).min(1).max(500).required(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
