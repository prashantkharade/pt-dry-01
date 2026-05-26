/////////////////////////////////////////////////////////////////////////
//  Service-wide configuration types
/////////////////////////////////////////////////////////////////////////

export type DatabaseDialect = 'postgres' | 'mysql' | 'sqlite';

export type ORMType = 'TypeORM' | 'Sequelize';

export type LoggerProvider = 'Custom' | 'Winston' | 'Pino' | 'Bunyan';

export type CacheProvider = 'Redis' | 'Memory';

export type AuthenticationProvider = 'Custom' | 'Firebase' | 'Auth0';

export type AuthorizationProvider = 'Custom';

export type SmsProvider = 'MSG91' | 'Twilio' | 'Custom';

export type EmailProvider = 'SMTP' | 'SendGrid' | 'SES';

export type MobileNotificationProvider = 'Firebase' | 'OneSignal';

export interface Configurations {
    SystemIdentifier   : string;
    ServiceName        : string;
    BaseUrl            : string;
    Port               : number;
    ApiVersion         : string;
    Logger             : { Provider: LoggerProvider; Level: string };
    Database           : { Type: DatabaseDialect; ORM: ORMType };
    Cache              : { Provider: CacheProvider };
    Authentication     : { Provider: AuthenticationProvider };
    Authorization      : { Provider: AuthorizationProvider };
    Sms                : { Provider: SmsProvider };
    Email              : { Provider: EmailProvider };
    MobileNotification : { Provider: MobileNotificationProvider };
    MaxUploadFileSize  : number;
    Telemetry          : boolean;
    TemporaryFolders   : {
        UploadFolder              : string;
        DownloadFolder            : string;
        CleanupFolderBeforeMinutes: number;
    };
    Auth: {
        AccessTokenExpiresInSeconds : number;
        RefreshTokenExpiresInSeconds: number;
        OtpValidityInMinutes        : number;
    };
}
