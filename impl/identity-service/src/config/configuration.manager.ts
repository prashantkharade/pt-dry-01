import * as defaultConfiguration from './config.json';
import * as localConfiguration from './config.local.json';
import { Configurations } from './configuration.types';

/////////////////////////////////////////////////////////////////////////

export class ConfigurationManager {

    static _config: Configurations = null;

    public static loadConfigurations = (): void => {
        const config = (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'test')
            ? localConfiguration as unknown as Configurations
            : defaultConfiguration as unknown as Configurations;

        ConfigurationManager._config = {
            SystemIdentifier   : config.SystemIdentifier,
            ServiceName        : config.ServiceName,
            BaseUrl            : process.env.BASE_URL ?? config.BaseUrl,
            Port               : parseInt(process.env.PORT ?? String(config.Port), 10),
            ApiVersion         : config.ApiVersion,
            Logger             : config.Logger,
            Database           : config.Database,
            Cache              : config.Cache,
            Authentication     : config.Authentication,
            Authorization      : config.Authorization,
            Sms                : config.Sms,
            Email              : config.Email,
            MobileNotification : config.MobileNotification,
            MaxUploadFileSize  : config.MaxUploadFileSize,
            Telemetry          : config.Telemetry,
            TemporaryFolders   : config.TemporaryFolders,
            Auth               : config.Auth,
        };
    };

    public static get BaseUrl(): string { return ConfigurationManager._config.BaseUrl; }
    public static get Port(): number { return ConfigurationManager._config.Port; }
    public static get ServiceName(): string { return ConfigurationManager._config.ServiceName; }
    public static get SystemIdentifier(): string { return ConfigurationManager._config.SystemIdentifier; }
    public static get ApiVersion(): string { return ConfigurationManager._config.ApiVersion; }
    public static get DatabaseDialect() { return ConfigurationManager._config.Database.Type; }
    public static get DatabaseORM() { return ConfigurationManager._config.Database.ORM; }
    public static get CacheProvider() { return ConfigurationManager._config.Cache.Provider; }
    public static get SmsProvider() { return ConfigurationManager._config.Sms.Provider; }
    public static get EmailProvider() { return ConfigurationManager._config.Email.Provider; }
    public static get MaxUploadFileSize(): number { return ConfigurationManager._config.MaxUploadFileSize; }
    public static get Auth() { return ConfigurationManager._config.Auth; }
    public static get TemporaryFolders() { return ConfigurationManager._config.TemporaryFolders; }

    /////////////////////////////////////////////////////////////////////////
    //  Convenience accessors over process.env — used where a value is purely
    //  deployment-specific (URLs, secrets, API keys) and is not part of the
    //  declarative config.json.
    /////////////////////////////////////////////////////////////////////////

    public static getEnv(key: string, fallback?: string): string {
        const value = process.env[key] ?? fallback;
        if (value === undefined) {
            throw new Error(`Missing required env var: ${key}`);
        }
        return value;
    }

    public static getEnvOptional(key: string): string | undefined {
        return process.env[key];
    }

    public static getEnvNumber(key: string, fallback?: number): number {
        const raw = process.env[key];
        if (raw === undefined) {
            if (fallback === undefined) throw new Error(`Missing required env var: ${key}`);
            return fallback;
        }
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error(`env ${key} is not a number: ${raw}`);
        return n;
    }

    public static getEnvBool(key: string, fallback = false): boolean {
        const v = process.env[key];
        if (v === undefined) return fallback;
        return v === '1' || v.toLowerCase() === 'true';
    }
}
