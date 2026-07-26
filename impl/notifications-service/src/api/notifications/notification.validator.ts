import express from 'express';
import joi from 'joi';
import { ErrorHandler } from '../../common/api.error';

export class NotificationValidator {

    public static validateSend = async (request: express.Request) => {
        try {
            const schema = joi.object({
                Channel     : joi.string().valid('SMS', 'Email', 'WhatsApp', 'Push', 'InApp').required(),
                //An address for SMS/Email/WhatsApp; a UserId for Push, since
                //push fans out to every device that user has registered.
                Recipient   : joi.string().max(255).required(),
                Subject     : joi.string().max(255).optional(),
                //Plain text. For email this becomes the text/plain alternative.
                Body        : joi.string().required(),
                //Optional rich part — email only. Ignored by other channels.
                HtmlBody    : joi.string().optional(),
                TemplateCode: joi.string().max(64).optional(),
                //Lets a caller address push by user while still recording a
                //human-readable recipient on the log row.
                UserId      : joi.string().uuid().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };

    /** Render a seeded template and send it — the path other services use. */
    public static validateSendTemplate = async (request: express.Request) => {
        try {
            const schema = joi.object({
                TemplateCode : joi.string().max(64).required(),
                Channel      : joi.string().valid('SMS', 'Email', 'WhatsApp', 'Push', 'InApp').required(),
                Recipient    : joi.string().max(255).required(),
                //Required for service-to-service callers: they fire off a
                //domain event with no user in scope, so there is no token to
                //take the tenant from. Ignored when a user token IS present —
                //the controller trusts the token over the body.
                TenantId     : joi.string().uuid().optional(),
                //Every code is seeded in both en and mr — there is a test that
                //fails the build on any gap — so this cannot silently miss.
                Language     : joi.string().valid('en', 'mr').default('en'),
                Variables    : joi.object().pattern(joi.string(), joi.alternatives(joi.string(), joi.number())).default({}),
                UserId       : joi.string().uuid().optional(),
            });
            return await schema.validateAsync(request.body, { abortEarly: false });
        } catch (error) {
            ErrorHandler.handleValidationError(error);
            throw error;
        }
    };
}
