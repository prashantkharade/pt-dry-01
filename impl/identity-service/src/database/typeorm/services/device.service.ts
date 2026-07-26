import { injectable } from 'tsyringe';
import { In, IsNull, Not } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { UserDevice } from '../models/user.device.model';
import { BaseService } from './base.service';
import { ErrorHandler } from '../../../common/api.error';
import { logger } from '../../../logger/logger';
import {
    DeviceDto, DeviceRegisterModel, PushTargetDto,
} from '../../../domain.types/users/device.types';

/////////////////////////////////////////////////////////////////////////
//  Device registry — the address book push notifications are sent to.
//
//  The important behaviours here are all about tokens being unstable:
//  FCM rotates them, users reinstall, and the same physical phone can be
//  handed to a different user. Each is handled explicitly below.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class DeviceService extends BaseService {

    private _repo = Source.getRepository(UserDevice);

    private toDto = (d: UserDevice): DeviceDto => ({
        id           : d.id,
        UserId       : d.UserId,
        DeviceId     : d.DeviceId,
        DeviceName   : d.DeviceName,
        Platform     : d.Platform,
        AppVersion   : d.AppVersion,
        OsVersion    : d.OsVersion,
        //Never return the token itself — it is a send capability. Anyone
        //holding it can push to that device via our Firebase project.
        HasPushToken : Boolean(d.FcmToken),
        FirstSeenAt  : d.FirstSeenAt,
        LastSeenAt   : d.LastSeenAt,
    });

    /**
     * Register or refresh a device. Idempotent on (UserId, DeviceId): the app
     * calls this on every launch and whenever FCM hands it a new token, so it
     * must update in place rather than pile up a row per launch.
     */
    public register = async (model: DeviceRegisterModel): Promise<DeviceDto> => {
        //One FCM token addresses exactly one app install. If it now belongs to
        //a different user — shared/handed-over phone, or a reinstall FCM reused
        //the token for — the previous owner's row must give it up, or they
        //would keep receiving this user's notifications on this device.
        if (model.FcmToken) {
            await this.detachTokenFromOtherUsers(model.FcmToken, model.UserId);
        }

        const existing = await this._repo.findOne({
            where: { UserId: model.UserId, DeviceId: model.DeviceId, RevokedAt: IsNull() },
        });

        if (existing) {
            existing.DeviceName = model.DeviceName ?? existing.DeviceName;
            existing.Platform   = model.Platform   ?? existing.Platform;
            existing.AppVersion = model.AppVersion ?? existing.AppVersion;
            existing.OsVersion  = model.OsVersion  ?? existing.OsVersion;
            //Only overwrite the token when a new one is supplied — a launch
            //without push permission must not wipe a previously granted token.
            if (model.FcmToken) existing.FcmToken = model.FcmToken;
            existing.IpAddress  = model.IpAddress ?? existing.IpAddress;
            existing.UserAgent  = model.UserAgent ?? existing.UserAgent;
            existing.LastSeenAt = new Date();
            return this.toDto(await this._repo.save(existing));
        }

        const saved = await this._repo.save(this._repo.create({
            UserId     : model.UserId,
            DeviceId   : model.DeviceId,
            DeviceName : model.DeviceName,
            Platform   : model.Platform,
            AppVersion : model.AppVersion,
            OsVersion  : model.OsVersion,
            FcmToken   : model.FcmToken,
            IpAddress  : model.IpAddress,
            UserAgent  : model.UserAgent,
            LastSeenAt : new Date(),
        }));
        logger.info(`Device registered user=${model.UserId} device=${model.DeviceId} platform=${model.Platform ?? 'unknown'}`);
        return this.toDto(saved);
    };

    private detachTokenFromOtherUsers = async (fcmToken: string, keepUserId: string): Promise<void> => {
        const stale = await this._repo.find({
            where: { FcmToken: fcmToken, UserId: Not(keepUserId), RevokedAt: IsNull() },
        });
        if (stale.length === 0) return;
        for (const row of stale) row.FcmToken = null;
        await this._repo.save(stale);
        logger.info(`Detached FCM token from ${stale.length} other user device row(s) — device changed hands`);
    };

    public listForUser = async (userId: string): Promise<DeviceDto[]> => {
        const rows = await this._repo.find({
            where : { UserId: userId, RevokedAt: IsNull() },
            order : { LastSeenAt: 'DESC' },
        });
        return rows.map(this.toDto);
    };

    /**
     * Revoke a device. Ownership is checked here rather than in the controller
     * so the check can't be forgotten by a future caller: without it, passing
     * someone else's device id would silently revoke their session.
     */
    public revoke = async (id: string, requestingUserId: string): Promise<void> => {
        const device = await this._repo.findOne({ where: { id } });
        if (!device || device.RevokedAt) ErrorHandler.throwNotFoundError('Device not found');
        if (device.UserId !== requestingUserId) {
            //404 rather than 403 — a 403 would confirm the device exists.
            ErrorHandler.throwNotFoundError('Device not found');
        }
        device.RevokedAt = new Date();
        device.FcmToken  = null;
        await this._repo.save(device);
        logger.info(`Device revoked id=${id} user=${requestingUserId}`);
    };

    /** Every push target for a set of users. Called by notifications-service. */
    public pushTargetsForUsers = async (userIds: string[]): Promise<PushTargetDto[]> => {
        if (userIds.length === 0) return [];
        const rows = await this._repo.find({
            where: { UserId: In(userIds), RevokedAt: IsNull(), FcmToken: Not(IsNull()) },
        });
        return rows.map((r) => ({ UserId: r.UserId, FcmToken: r.FcmToken, Platform: r.Platform }));
    };

    /**
     * Drop a token FCM told us is dead (UNREGISTERED / InvalidRegistration).
     * Without this, dead tokens accumulate forever and every send burns quota
     * on devices that uninstalled months ago.
     */
    public purgeToken = async (fcmToken: string): Promise<number> => {
        const rows = await this._repo.find({ where: { FcmToken: fcmToken } });
        if (rows.length === 0) return 0;
        for (const row of rows) row.FcmToken = null;
        await this._repo.save(rows);
        logger.info(`Purged dead FCM token from ${rows.length} device row(s)`);
        return rows.length;
    };
}
