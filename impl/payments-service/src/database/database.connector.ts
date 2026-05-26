import { TypeormDatabaseConnector } from './typeorm/typeorm.database.connector';
import { ConfigurationManager } from '../config/configuration.manager';
import { logger } from '../logger/logger';

export class DatabaseConnector {
    public static setup = async (): Promise<void> => {
        const orm = ConfigurationManager.DatabaseORM;
        if (orm === 'TypeORM') {
            await TypeormDatabaseConnector.connect();
            logger.info('Database connected via TypeORM');
            return;
        }
        throw new Error(`Unsupported ORM: ${orm}`);
    };

    public static teardown = async (): Promise<void> => {
        await TypeormDatabaseConnector.disconnect();
    };
}
