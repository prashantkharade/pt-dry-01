import { DependencyContainer } from 'tsyringe';
import { PaymentService } from '../database/typeorm/services/payment.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { ZohopayProvider } from './providers/zohopay.provider';
import { NotificationsServiceConnector } from './notifications/notifications.service.connector';

export class ModuleInjector {
    public static registerInjections = (container: DependencyContainer): void => {
        container.registerSingleton(RazorpayProvider);
        container.registerSingleton(ZohopayProvider);
        container.registerSingleton(NotificationsServiceConnector);
        container.registerSingleton(PaymentService);
    };
}
