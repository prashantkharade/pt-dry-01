import express from 'express';
import joi from 'joi';
import {
    OtpSendModel, OtpVerifyModel, PasswordLoginModel,
} from '../../domain.types/auth/auth.types';
import { ErrorHandler } from '../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  Joi-backed input validators for /auth routes. Each method returns a
//  typed model; controllers stay free of validation concerns.
/////////////////////////////////////////////////////////////////////////

const PhoneSchema    = joi.string().pattern(/^\+91[6-9]\d{9}$/).message('Phone must be +91XXXXXXXXXX');

export class AuthValidator {

    public static validateOtpSend = async (request: express.Request): Promise<OtpSendModel> => {
        try {
            const schema = joi.object({ Phone: PhoneSchema.required() });
            const value  = await schema.validateAsync(request.body, { abortEarly: false });
            return { Phone: value.Phone };
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validateOtpVerify = async (request: express.Request): Promise<OtpVerifyModel> => {
        try {
            const schema = joi.object({
                Phone: PhoneSchema.required(),
                Otp  : joi.string().length(6).pattern(/^\d{6}$/).required(),
            });
            const value = await schema.validateAsync(request.body, { abortEarly: false });
            return { Phone: value.Phone, Otp: value.Otp };
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    public static validatePasswordLogin = async (request: express.Request): Promise<PasswordLoginModel> => {
        try {
            const schema = joi.object({
                EmailOrPhone: joi.string().min(3).required(),
                Password    : joi.string().min(6).required(),
            });
            const value = await schema.validateAsync(request.body, { abortEarly: false });
            return { EmailOrPhone: value.EmailOrPhone, Password: value.Password };
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
