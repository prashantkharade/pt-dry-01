import express from 'express';
import { container } from 'tsyringe';
import { NotificationService } from '../../database/typeorm/services/notification.service';
import { NotificationValidator } from './notification.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { NotificationQueue } from '../../modules/queue/notification.queue';

export class NotificationController {

    private _notifs = container.resolve(NotificationService);

    public send = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const u     = request.currentUser;
            const input = await NotificationValidator.validateSend(request);
            const log   = await this._notifs.send({ ...input, TenantId: u.TenantId });
            return ResponseHandler.created(request, response, 'Notification dispatched', log);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  POST /notifications/send-template — the path other services use.
    //  They name an event ('ORDER_READY') and pass variables; the copy,
    //  language and channel formatting live here, not in every caller.
    public sendTemplate = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await NotificationValidator.validateSendTemplate(request);

            //This route is reachable both ways:
            //  - a service firing a domain event: no user token, TenantId in body
            //  - the portal: user token present
            //The token wins when present — a caller must never be able to
            //override its own tenant by putting a different one in the body.
            const tenantId = request.currentUser?.TenantId ?? input.TenantId;
            if (!tenantId) {
                return ResponseHandler.failure(request, response,
                    'TenantId is required when calling without a user token', 400);
            }

            //Channel is part of the lookup key — the same Code exists once per
            //channel and they are different media.
            const rendered = await this._notifs.renderTemplate(
                tenantId, input.TemplateCode, input.Channel, input.Variables, input.Language);

            const log = await this._notifs.send({
                TenantId     : tenantId,
                Channel      : input.Channel,
                Recipient    : input.Recipient,
                Subject      : rendered.Subject,
                //Email templates render HTML; the channel derives the text part.
                Body         : rendered.Body,
                HtmlBody     : input.Channel === 'Email' ? rendered.Body : undefined,
                TemplateCode : input.TemplateCode,
                UserId       : input.UserId,
            });
            return ResponseHandler.created(request, response, 'Notification dispatched', log);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /notifications/logs — delivery history for the ops dashboard.
    public logs = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const items = await this._notifs.listLogs(request.currentUser.TenantId);
            return ResponseHandler.success(request, response, 'OK', 200, { Items: items, Total: items.length });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /notifications/queue-stats — is anything stuck or failing?
    public queueStats = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const stats = await NotificationQueue.stats();
            return ResponseHandler.success(request, response, 'OK', 200, { ...stats, Backed: NotificationQueue.isBacked });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
