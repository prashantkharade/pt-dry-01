export type DatabaseDialect           = 'postgres' | 'mysql' | 'sqlite';
export type ORMType                   = 'TypeORM' | 'Sequelize';
export type LoggerProvider            = 'Custom' | 'Winston' | 'Pino' | 'Bunyan';
export type CacheProvider             = 'Redis' | 'Memory';
export type SmsProvider               = 'MSG91' | 'Twilio' | 'Custom';
export type EmailProvider             = 'SMTP' | 'SendGrid' | 'SES';
export type MobileNotificationProvider= 'Firebase' | 'OneSignal';
export type WhatsAppProvider          = 'Meta' | 'Twilio' | 'Custom';

export interface Configurations {
    SystemIdentifier  : string;
    ServiceName       : string;
    BaseUrl           : string;
    Port              : number;
    ApiVersion        : string;
    Logger            : { Provider: LoggerProvider; Level: string };
    Database          : { Type: DatabaseDialect; ORM: ORMType };
    Cache             : { Provider: CacheProvider };
    Sms               : { Provider: SmsProvider };
    Email             : { Provider: EmailProvider };
    MobileNotification: { Provider: MobileNotificationProvider };
    WhatsApp          : { Provider: WhatsAppProvider; Enabled: boolean };
    TemporaryFolders  : { UploadFolder: string; DownloadFolder: string; CleanupFolderBeforeMinutes: number };
    MaxUploadFileSize : number;
    Telemetry         : boolean;
}
