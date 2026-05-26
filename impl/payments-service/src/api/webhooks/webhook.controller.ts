import express from 'express';
import { container } from 'tsyringe';
import { PaymentService } from '../../database/typeorm/services/payment.service';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Webhook endpoints — public (no JWT). Signature verification is the
//  responsibility of each provider helper before persisting the event.
/////////////////////////////////////////////////////////////////////////

export class WebhookController {

    private _payments = container.resolve(PaymentService);

    public razorpay = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const eventType = (request.body?.event ?? 'unknown') as string;
            logger.info(`razorpay.webhook event=${eventType}`);
            await this._payments.ingestWebhook('Razorpay', eventType, request.body);
            return ResponseHandler.success(request, response, 'Webhook received', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public zohopay = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const eventType = (request.body?.event_type ?? 'unknown') as string;
            logger.info(`zohopay.webhook event=${eventType}`);
            await this._payments.ingestWebhook('Zohopay', eventType, request.body);
            return ResponseHandler.success(request, response, 'Webhook received', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
