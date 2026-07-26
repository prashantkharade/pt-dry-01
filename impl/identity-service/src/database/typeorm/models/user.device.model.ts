import {
    Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/////////////////////////////////////////////////////////////////////////
//  One row per device a user has signed in from.
//
//  Serves two purposes:
//    - push delivery: FcmToken is the address notifications-service sends to
//    - "your active sessions" UI: the user can see and revoke devices
//
//  Revocation is a soft RevokedAt stamp rather than a delete, so a revoked
//  device leaves a trail. Both indexes are partial on RevokedAt IS NULL —
//  a revoked row must not block re-registering the same device later.
/////////////////////////////////////////////////////////////////////////

export type DevicePlatform = 'Android' | 'iOS' | 'Web';

@Entity({ name: 'user_devices' })
@Index('ix_user_devices_user_active', ['UserId'], { where: '"RevokedAt" IS NULL' })
@Index('ux_user_devices_user_device', ['UserId', 'DeviceId'], { unique: true, where: '"RevokedAt" IS NULL' })
export class UserDevice {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'UserId', type: 'uuid' })
    UserId: string;

    //Stable per-install fingerprint. Distinct from FcmToken, which rotates.
    @Column({ name: 'DeviceId', type: 'varchar', length: 128 })
    DeviceId: string;

    @Column({ name: 'DeviceName', type: 'varchar', length: 255, nullable: true })
    DeviceName: string;

    @Column({ name: 'Platform', type: 'varchar', length: 16, nullable: true })
    Platform: DevicePlatform;

    @Column({ name: 'AppVersion', type: 'varchar', length: 32, nullable: true })
    AppVersion: string;

    @Column({ name: 'OsVersion', type: 'varchar', length: 32, nullable: true })
    OsVersion: string;

    //Nullable: a device may be registered before the user grants push
    //permission, and FCM tokens rotate independently of the install.
    @Column({ name: 'FcmToken', type: 'varchar', length: 512, nullable: true })
    FcmToken: string;

    @Column({ name: 'IpAddress', type: 'varchar', length: 64, nullable: true })
    IpAddress: string;

    @Column({ name: 'UserAgent', type: 'varchar', length: 512, nullable: true })
    UserAgent: string;

    @CreateDateColumn({ name: 'FirstSeenAt' })
    FirstSeenAt: Date;

    @Column({ name: 'LastSeenAt', type: 'timestamptz', default: () => 'now()' })
    LastSeenAt: Date;

    @Column({ name: 'RevokedAt', type: 'timestamptz', nullable: true })
    RevokedAt: Date;
}
