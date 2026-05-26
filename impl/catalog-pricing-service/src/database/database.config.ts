import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Per-service database configuration — see identity-service for the
//  full doc comment. DB_DIALECT chooses postgres / mysql / sqlite.
/////////////////////////////////////////////////////////////////////////

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

export interface DatabaseConfig {
    Dialect    : SqlDialect;
    Url?       : string;
    Host?      : string;
    Port?      : number;
    Username?  : string;
    Password?  : string;
    Database?  : string;
    Schema?    : string;
    SqliteFile?: string;
    Logging    : boolean;
    Synchronize: boolean;
}

const DEFAULT_PORTS: Record<SqlDialect, number> = { postgres: 5432, mysql: 3306, sqlite: 0 };

const normalizeDialect = (raw: string | undefined): SqlDialect => {
    const v = (raw ?? '').toLowerCase();
    if (v === 'mysql' || v === 'mariadb')                     return 'mysql';
    if (v === 'sqlite' || v === 'sqlite3')                    return 'sqlite';
    if (v === 'postgres' || v === 'postgresql' || v === 'pg') return 'postgres';
    return 'postgres';
};

export class DatabaseConfigProvider {

    public static get = (): DatabaseConfig => {
        const dialect = normalizeDialect(
            process.env.DB_DIALECT ?? (ConfigurationManager.DatabaseDialect as unknown as string),
        );

        if (dialect === 'sqlite') {
            return {
                Dialect    : 'sqlite',
                SqliteFile : process.env.CATALOG_PRICING_DB_FILE ?? './data/catalog_pricing.sqlite',
                Logging    : ConfigurationManager.getEnvBool('LOG_SQL', false),
                Synchronize: ConfigurationManager.getEnvBool('DB_SYNC', process.env.NODE_ENV !== 'production'),
            };
        }

        const url = process.env.CATALOG_PRICING_DB_URL ?? process.env.DATABASE_URL;

        return {
            Dialect    : dialect,
            Url        : url,
            Host       : process.env.DB_HOST ?? '127.0.0.1',
            Port       : process.env.DB_PORT ? Number(process.env.DB_PORT) : DEFAULT_PORTS[dialect],
            Username   : process.env.DB_USER ?? 'ptk',
            Password   : process.env.DB_PASSWORD ?? 'ptk',
            Database   : process.env.CATALOG_PRICING_DB_NAME ?? process.env.DB_NAME ?? 'catalog_pricing_db',
            Schema     : dialect === 'postgres' ? (process.env.DB_SCHEMA ?? 'public') : undefined,
            Logging    : ConfigurationManager.getEnvBool('LOG_SQL', false),
            Synchronize: ConfigurationManager.getEnvBool('DB_SYNC', process.env.NODE_ENV !== 'production'),
        };
    };
}
