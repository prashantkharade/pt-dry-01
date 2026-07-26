export type DevicePlatform = 'Android' | 'iOS' | 'Web';

export interface DeviceRegisterModel {
    UserId      : string;
    DeviceId    : string;
    DeviceName? : string;
    Platform?   : DevicePlatform;
    AppVersion? : string;
    OsVersion?  : string;
    FcmToken?   : string;
    IpAddress?  : string;
    UserAgent?  : string;
}

export interface DeviceDto {
    id          : string;
    UserId      : string;
    DeviceId    : string;
    DeviceName  : string;
    Platform    : DevicePlatform;
    AppVersion  : string;
    OsVersion   : string;
    HasPushToken: boolean;
    FirstSeenAt : Date;
    LastSeenAt  : Date;
}

/** Shape returned to notifications-service when it asks where to push. */
export interface PushTargetDto {
    UserId   : string;
    FcmToken : string;
    Platform : DevicePlatform;
}
