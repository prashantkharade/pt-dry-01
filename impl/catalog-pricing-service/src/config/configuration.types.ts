export type DatabaseDialect = 'postgres' | 'mysql' | 'sqlite';
export type ORMType         = 'TypeORM' | 'Sequelize';
export type LoggerProvider  = 'Custom' | 'Winston' | 'Pino' | 'Bunyan';
export type CacheProvider   = 'Redis' | 'Memory';

export interface Configurations {
    SystemIdentifier : string;
    ServiceName      : string;
    BaseUrl          : string;
    Port             : number;
    ApiVersion       : string;
    Logger           : { Provider: LoggerProvider; Level: string };
    Database         : { Type: DatabaseDialect; ORM: ORMType };
    Cache            : { Provider: CacheProvider };
    TemporaryFolders : {
        UploadFolder              : string;
        DownloadFolder            : string;
        CleanupFolderBeforeMinutes: number;
    };
    MaxUploadFileSize: number;
    Telemetry        : boolean;
}
