import express from 'express';
import { container } from 'tsyringe';
import { PaymentService } from '../../database/typeorm/services/payment.service';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { WebhookSignatureVerifier, WebhookProvider } from '../../modules/webhooks/webhook.signature.verifier';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Webhook endpoints — public (no JWT). Payment providers POST here
//  directly and cannot carry our token, so the HMAC signature over the raw
//  body is the ONLY thing standing between this endpoint and an attacker
//  marking arbitrary orders paid. Verification happens before we persist
//  anything or run any side effect.
/////////////////////////////////////////////////////////////////////////

export class WebhookController {

    private _payments = container.resolve(PaymentService);

    private handle = async (
        provider        : WebhookProvider,
        signatureHeader : string,
        eventIdOf       : (req: express.Request) => string | undefined,
        eventTypeOf     : (body: any) => string,
        request         : express.Request,
        response        : express.Response,
    ): Promise<express.Response> => {
        try {
            const signature = request.headers[signatureHeader] as string | undefined;
            const result    = WebhookSignatureVerifier.verify(provider, request.rawBody, signature);

            if (!result.Verified) {
                //401, not 400: this is an authentication failure. The body is
                //deliberately terse — a probing attacker learns nothing beyond
                //"rejected", while the real reason is in our logs.
                return ResponseHandler.failure(request, response, 'Invalid webhook signature', 401);
            }

            const eventType = eventTypeOf(request.body);
            const eventId   = eventIdOf(request);
            logger.info(`${provider}.webhook verified event=${eventType} id=${eventId ?? 'n/a'}`);

            const outcome = await this._payments.ingestWebhook(provider, eventType, request.body, eventId);

            //A duplicate is a success from the provider's point of view — it
            //did its job. Returning non-2xx would only make it retry harder.
            if (outcome.Duplicate) {
                logger.info(`${provider}.webhook duplicate id=${eventId} — already processed, skipping side effects`);
            }
            return ResponseHandler.success(request, response, 'Webhook received', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    public razorpay = async (request: express.Request, response: express.Response): Promise<express.Response> =>
        this.handle(
            'Razorpay',
            'x-razorpay-signature',
            (req) => req.headers['x-razorpay-event-id'] as string | undefined,
            (body) => (body?.event ?? 'unknown') as string,
            request, response,
        );

    public zohopay = async (request: express.Request, response: express.Response): Promise<express.Response> =>
        this.handle(
            'Zohopay',
            'x-zoho-webhook-signature',
            //Zoho carries no event-id header; the payment id in the payload is
            //the most stable per-event key available.
            (req) => (req.body?.event_object?.payment?.payment_id ?? req.body?.payment_id) as string | undefined,
            (body) => (body?.event_type ?? 'unknown') as string,
            request, response,
        );
}
