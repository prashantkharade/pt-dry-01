import Joi from 'joi';
import type { Request } from 'express';

const phoneSchema = Joi.string().pattern(/^\+91[6-9]\d{9}$/).message('Phone must be +91XXXXXXXXXX');

export const AuthValidator = {
  async validateOtpSend(req: Request) {
    const schema = Joi.object({ phone: phoneSchema.required() });
    return schema.validateAsync(req.body, { abortEarly: false });
  },
  async validateOtpVerify(req: Request) {
    const schema = Joi.object({
      phone: phoneSchema.required(),
      otp: Joi.string().length(6).pattern(/^\d{6}$/).required(),
    });
    return schema.validateAsync(req.body, { abortEarly: false });
  },
  async validatePasswordLogin(req: Request) {
    const schema = Joi.object({
      emailOrPhone: Joi.string().min(3).required(),
      password: Joi.string().min(6).required(),
    });
    return schema.validateAsync(req.body, { abortEarly: false });
  },
};
