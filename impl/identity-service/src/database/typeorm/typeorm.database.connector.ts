import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseConfigProvider, DatabaseConfig } from '../database.config';
import { logger }            from '../../logger/logger';
import { Tenant }          from './models/tenant.model';
import { Branch }          from './models/branch.model';
import { User }            from './models/user.model';
import { Role }            from './models/role.model';
import { UserRole }        from './models/user.role.model';
import { Customer }        from './models/customer.model';
import { CustomerAddress } from './models/customer.address.model';
import { ClientApp }       from './models/client.app.model';

/////////////////////////////////////////////////////////////////////////
//  TypeORM DataSource singleton. Dialect (postgres / mysql / sqlite) is
//  selected by DatabaseConfigProvider, which reads DB_DIALECT.
//
//  The DataSource is built lazily inside connect() so dotenv.config()
//  in index.ts has run before we read process.env.
//
//  On connect, the target database is auto-created if missing
//  (postgres & mysql) — see ensurePostgresDatabase / ensureMysqlDatabase.
//
//  Use Source.getRepository(Entity) — do not construct another DataSource.
/////////////////////////////////////////////////////////////////////////

const ENTITIES = [Tenant, Branch, User, Role, UserRole, Customer, CustomerAddress, ClientApp];

let _source: DataSource | null = null;

const buildOptions = (cfg: DatabaseConfig): DataSourceOptions => {
    if (cfg.Dialect === 'sqlite') {
        const file = cfg.SqliteFile;
        const dir  = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return {
            type        : 'sqlite',
            database    : file,
            entities    : ENTITIES,
            synchronize : cfg.Synchronize,
            logging     : cfg.Logging,
        };
    }
    if (cfg.Dialect === 'mysql') {
        return cfg.Url ? {
            type        : 'mysql',
            url         : cfg.Url,
            entities    : ENTITIES,
            synchronize : cfg.Synchronize,
            logging     : cfg.Logging,
        } : {
            type        : 'mysql',
            host        : cfg.Host,
            port        : cfg.Port,
            username    : cfg.Username,
            password    : cfg.Password,
            database    : cfg.Database,
            entities    : ENTITIES,
            synchronize : cfg.Synchronize,
            logging     : cfg.Logging,
        };
    }
    return cfg.Url ? {
        type        : 'postgres',
        url         : cfg.Url,
        schema      : cfg.Schema,
        entities    : ENTITIES,
        synchronize : cfg.Synchronize,
        logging     : cfg.Logging,
    } : {
        type        : 'postgres',
        host        : cfg.Host,
        port        : cfg.Port,
        username    : cfg.Username,
        password    : cfg.Password,
        database    : cfg.Database,
        schema      : cfg.Schema,
        entities    : ENTITIES,
        synchronize : cfg.Synchronize,
        logging     : cfg.Logging,
    };
};

const resolveConnectionParts = (cfg: DatabaseConfig) => {
    if (!cfg.Url) {
        return {
            host    : cfg.Host,
            port    : cfg.Port,
            user    : cfg.Username,
            password: cfg.Password,
            database: cfg.Database,
        };
    }
    const u = new URL(cfg.Url);
    return {
        host    : u.hostname,
        port    : u.port ? Number(u.port) : cfg.Port,
        user    : decodeURIComponent(u.username || cfg.Username || ''),
        password: decodeURIComponent(u.password || cfg.Password || ''),
        database: u.pathname && u.pathname !== '/' ? decodeURIComponent(u.pathname.slice(1)) : cfg.Database,
    };
};

const isValidDbIdentifier = (name: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

const ensurePostgresDatabase = async (cfg: DatabaseConfig): Promise<void> => {
    const { Client } = await import('pg');
    const parts = resolveConnectionParts(cfg);
    if (!parts.database) return;
    if (!isValidDbIdentifier(parts.database)) {
        logger.warn(`Skipping auto-create — invalid postgres db name: ${parts.database}`);
        return;
    }
    const admin = new Client({
        host    : parts.host,
        port    : parts.port,
        user    : parts.user,
        password: parts.password,
        database: 'postgres',
    });
    try {
        await admin.connect();
        const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [parts.database]);
        if (exists.rowCount === 0) {
            await admin.query(`CREATE DATABASE "${parts.database.replace(/"/g, '""')}"`);
            logger.info(`✅ Created postgres database '${parts.database}'`);
        } else {
            logger.info(`ℹ️  Postgres database '${parts.database}' already exists`);
        }
    } finally {
        try { await admin.end(); } catch { /* ignore */ }
    }
};

const ensureMysqlDatabase = async (cfg: DatabaseConfig): Promise<void> => {
    const mysql = await import('mysql2/promise');
    const parts = resolveConnectionParts(cfg);
    if (!parts.database) return;
    if (!isValidDbIdentifier(parts.database)) {
        logger.warn(`Skipping auto-create — invalid mysql db name: ${parts.database}`);
        return;
    }
    const admin = await mysql.createConnection({
        host    : parts.host,
        port    : parts.port,
        user    : parts.user,
        password: parts.password,
    });
    try {
        await admin.query(
            `CREATE DATABASE IF NOT EXISTS \`${parts.database.replace(/`/g, '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
        logger.info(`✅ Ensured mysql database '${parts.database}' exists`);
    } finally {
        try { await admin.end(); } catch { /* ignore */ }
    }
};

const ensureDatabaseExists = async (cfg: DatabaseConfig): Promise<void> => {
    try {
        if (cfg.Dialect === 'postgres') return await ensurePostgresDatabase(cfg);
        if (cfg.Dialect === 'mysql')    return await ensureMysqlDatabase(cfg);
    } catch (err: any) {
        logger.error(`Failed to ensure database exists (${cfg.Dialect}): ${err?.message ?? err}`);
        throw err;
    }
};

export const getSource = (): DataSource => {
    if (!_source) {
        const cfg = DatabaseConfigProvider.get();
        _source = new DataSource(buildOptions(cfg));
    }
    return _source;
};

export class TypeormDatabaseConnector {

    public static connect = async (): Promise<DataSource> => {
        const cfg = DatabaseConfigProvider.get();
        await ensureDatabaseExists(cfg);
        const source = getSource();
        if (!source.isInitialized) await source.initialize();
        return source;
    };

    public static disconnect = async (): Promise<void> => {
        if (_source?.isInitialized) await _source.destroy();
    };
}

// Backwards-compatible export — resolved lazily on first access.
export const Source = new Proxy({} as DataSource, {
    get: (_t, prop) => (getSource() as any)[prop],
    set: (_t, prop, value) => { (getSource() as any)[prop] = value; return true; },
});
