import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Per-service database configuration.
//
//  Dialect is chosen at runtime via the DB_DIALECT env var:
//    - "postgres" (default)
//    - "mysql"
//    - "sqlite"   (file-backed, zero infra — great for laptop dev)
//
//  Connection parameters can be supplied either as a single URL
//  (IDENTITY_DB_URL or DATABASE_URL) or as discrete fields
//  (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, IDENTITY_DB_NAME).
//
//  For SQLite, set DB_DIALECT=sqlite and optionally IDENTITY_DB_FILE
//  (defaults to ./data/identity.sqlite — created on first run).
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

const DEFAULT_PORTS: Record<SqlDialect, number> = {
    postgres: 5432,
    mysql   : 3306,
    sqlite  : 0,
};

const normalizeDialect = (raw: string | undefined): SqlDialect => {
    const v = (raw ?? '').toLowerCase();
    if (v === 'mysql' || v === 'mariadb')                          return 'mysql';
    if (v === 'sqlite' || v === 'sqlite3')                         return 'sqlite';
    if (v === 'postgres' || v === 'postgresql' || v === 'pg')      return 'postgres';
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
                SqliteFile : process.env.IDENTITY_DB_FILE ?? './data/identity.sqlite',
                Logging    : ConfigurationManager.getEnvBool('LOG_SQL', false),
                Synchronize: ConfigurationManager.getEnvBool('DB_SYNC', process.env.NODE_ENV !== 'production'),
            };
        }

        const url = process.env.IDENTITY_DB_URL ?? process.env.DATABASE_URL;

        return {
            Dialect    : dialect,
            Url        : url,
            Host       : process.env.DB_HOST ?? '127.0.0.1',
            Port       : process.env.DB_PORT ? Number(process.env.DB_PORT) : DEFAULT_PORTS[dialect],
            Username   : process.env.DB_USER ?? 'ptk',
            Password   : process.env.DB_PASSWORD ?? 'ptk',
            Database   : process.env.IDENTITY_DB_NAME ?? process.env.DB_NAME ?? 'identity_db',
            Schema     : dialect === 'postgres' ? (process.env.DB_SCHEMA ?? 'public') : undefined,
            Logging    : ConfigurationManager.getEnvBool('LOG_SQL', false),
            Synchronize: ConfigurationManager.getEnvBool('DB_SYNC', process.env.NODE_ENV !== 'production'),
        };
    };
}
