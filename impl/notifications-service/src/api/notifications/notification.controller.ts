import express from 'express';
import { container } from 'tsyringe';
import { NotificationService } from '../../database/typeorm/services/notification.service';
import { NotificationValidator } from './notification.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';

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
}
