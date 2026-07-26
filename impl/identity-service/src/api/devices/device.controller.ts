import express from 'express';
import { container } from 'tsyringe';
import { DeviceService } from '../../database/typeorm/services/device.service';
import { DeviceValidator } from './device.validator';
import { ResponseHandler } from '../../common/handlers/response.handler';

export class DeviceController {

    private _devices = container.resolve(DeviceService);

    //  POST /devices — register or refresh the caller's device.
    //  The app calls this on every launch and on FCM token rotation.
    public register = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const input = await DeviceValidator.validateRegister(request);
            //UserId comes from the token, never the body — otherwise a caller
            //could register a push token against someone else's account and
            //receive their notifications.
            const dto = await this._devices.register({
                ...input,
                UserId    : request.currentUser.UserId,
                IpAddress : request.ip,
                UserAgent : request.headers['user-agent'] as string,
            });
            return ResponseHandler.success(request, response, 'Device registered', 200, dto);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /devices — the caller's own active devices ("active sessions" UI).
    public listMine = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const dtos = await this._devices.listForUser(request.currentUser.UserId);
            return ResponseHandler.success(request, response, 'OK', 200, dtos);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  DELETE /devices/:id — revoke a device and stop pushing to it.
    public revoke = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            //Ownership is enforced in the service, not here.
            await this._devices.revoke(request.params.id, request.currentUser.UserId);
            return ResponseHandler.success(request, response, 'Device revoked', 200, { Ok: true });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  POST /devices/push-targets — internal; notifications-service only.
    public pushTargets = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const { UserIds } = await DeviceValidator.validatePushTargets(request);
            const targets = await this._devices.pushTargetsForUsers(UserIds);
            return ResponseHandler.success(request, response, 'OK', 200, targets);
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };

    //  POST /devices/purge-token — internal; notifications-service reports a
    //  token FCM rejected as permanently dead so we stop sending to it.
    public purgeToken = async (request: express.Request, response: express.Response): Promise<express.Response> => {
        try {
            const token = String(request.body?.FcmToken ?? '');
            if (!token) return ResponseHandler.failure(request, response, 'FcmToken is required', 400);
            const count = await this._devices.purgeToken(token);
            return ResponseHandler.success(request, response, 'OK', 200, { Purged: count });
        } catch (error) {
            return ResponseHandler.handleError(request, response, error);
        }
    };
}
