import axios from 'axios';
import { Source } from '../database/typeorm/typeorm.database.connector';
import { NotificationTemplate } from '../database/typeorm/models/notification.template.model';
import { logger } from '../logger/logger';
import { ConfigurationManager } from '../config/configuration.manager';

/////////////////////////////////////////////////////////////////////////
//  Seeds the core message templates that the rest of the platform
//  triggers (order booked, ready for delivery, OTP login, etc.). Pulls
//  the tenant from identity-service so templates land scoped correctly.
/////////////////////////////////////////////////////////////////////////

const TEMPLATES = [
    { Code: 'ORDER_BOOKED'   , Channel: 'SMS'  , Language: 'en', Body: 'PT Kharade: Order {{OrderCode}} booked. Total ₹{{Total}}.' },
    { Code: 'ORDER_BOOKED'   , Channel: 'SMS'  , Language: 'mr', Body: 'PT Kharade: ऑर्डर {{OrderCode}} बुक झाली. एकूण ₹{{Total}}.' },
    { Code: 'ORDER_READY'    , Channel: 'SMS'  , Language: 'en', Body: 'PT Kharade: Order {{OrderCode}} is ready for {{Mode}}.' },
    { Code: 'OTP_LOGIN'      , Channel: 'SMS'  , Language: 'en', Body: 'Your PT Kharade OTP is {{Otp}}. Valid for 5 minutes.' },
    { Code: 'ORDER_RECEIPT'  , Channel: 'Email', Language: 'en', Subject: 'Your PT Kharade order {{OrderCode}}', Body: 'Hello {{Name}}, thank you for your order. Total ₹{{Total}}.' },
];

async function fetchTenant(): Promise<{ TenantId: string } | null> {
    try {
        const baseUrl  = ConfigurationManager.getEnv('IDENTITY_SERVICE_URL', 'http://localhost:4001');
        const email    = ConfigurationManager.getEnv('SEED_ADMIN_EMAIL'    , 'admin@ptkharade.in');
        const password = ConfigurationManager.getEnv('SEED_ADMIN_PASSWORD' , 'Admin@12345');
        const res      = await axios.post(`${baseUrl}/api/v1/auth/login`, { EmailOrPhone: email, Password: password }, { timeout: 5000 });
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
