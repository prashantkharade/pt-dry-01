import axios from 'axios';
import { Source } from '../database/typeorm/typeorm.database.connector';
import { NotificationTemplate } from '../database/typeorm/models/notification.template.model';
import { logger } from '../logger/logger';
import { ConfigurationManager } from '../config/configuration.manager';
import { TEMPLATES } from './seed.templates';

/////////////////////////////////////////////////////////////////////////
//  Seeds the core message templates that the rest of the platform
//  triggers (order booked, ready for delivery, OTP login, etc.). Pulls
//  the tenant from identity-service so templates land scoped correctly.
/////////////////////////////////////////////////////////////////////////


async function fetchTenant(): Promise<{ TenantId: string } | null> {
    try {
        const baseUrl  = ConfigurationManager.getEnv('IDENTITY_SERVICE_URL', 'http://localhost:4001');
        const email    = ConfigurationManager.getEnv('SEED_ADMIN_EMAIL'    , 'admin@ptkharade.in');
        const password = ConfigurationManager.getEnv('SEED_ADMIN_PASSWORD' , 'Admin@12345');
        //Every identity-service route — login included — requires a registered
        //client key. "Anonymous" means no USER, not no CLIENT.
        const apiKey   = ConfigurationManager.getEnv('API_KEY_NOTIFICATIONS_SERVICE', 'notifications-service-dev-key');
        const res      = await axios.post(
            `${baseUrl}/api/v1/auth/login`,
            { EmailOrPhone: email, Password: password },
            { timeout: 5000, headers: { 'x-api-key': apiKey } },
        );
        const user     = res.data?.Data?.User;
        if (!user) return null;
        return { TenantId: user.TenantId };
    } catch {
        return null;
    }
}

export class Seeder {

    public static seed = async (): Promise<void> => {
        let scope: { TenantId: string } | null = null;
        for (let attempt = 0; attempt < 30 && !scope; attempt++) {
            scope = await fetchTenant();
            if (!scope) await new Promise((r) => setTimeout(r, 1000));
        }
        if (!scope) {
            logger.warn('notifications.seeder: could not reach identity-service; skipping template seed');
            return;
        }
        const repo = Source.getRepository(NotificationTemplate);
        for (const t of TEMPLATES) {
            const ex = await repo.findOne({ where: { TenantId: scope.TenantId, Code: t.Code, Language: t.Language, Channel: t.Channel } });
            if (!ex) await repo.save(repo.create({ ...t, TenantId: scope.TenantId, IsActive: true }));
        }
        logger.info(`Seeder: templates seeded tenantId=${scope.TenantId}`);
    };
}
