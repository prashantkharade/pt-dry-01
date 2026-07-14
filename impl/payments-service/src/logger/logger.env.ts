import * as defaultConfig from '../config/config.json';
import * as localConfig from '../config/config.local.json';

/////////////////////////////////////////////////////////////////////////
//  Resolves the values the logger stack needs (service name, provider,
//  level) once, from the same config files the ConfigurationManager uses.
//  Kept self-contained so the logger can be imported before the app has
//  finished loading its configuration.
/////////////////////////////////////////////////////////////////////////

const _cfg: any = (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'test')
    ? (localConfig as any)
    : (defaultConfig as any);

export type LoggerProviderName = 'Custom' | 'Winston';

export const SERVICE_NAME: string = process.env.SERVICE_NAME ?? _cfg?.ServiceName ?? 'service';

export const LOG_PROVIDER: LoggerProviderName =
    (process.env.LOGGER_PROVIDER ?? _cfg?.Logger?.Provider ?? 'Custom') as LoggerProviderName;

export const LOG_LEVEL: string = (process.env.LOG_LEVEL ?? _cfg?.Logger?.Level ?? 'info')
    .toString()
    .toLowerCase();

export const IS_PRODUCTION: boolean = process.env.NODE_ENV === 'production';

export const IS_TEST: boolean = process.env.NODE_ENV === 'test';
