import { DependencyContainer } from 'tsyringe';
import { NotificationService } from '../database/typeorm/services/notification.service';
import { SmsChannel } from './channels/sms.channel';
import { EmailChannel } from './channels/email.channel';
import { PushChannel } from './channels/push.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';

export class ModuleInjector {
    public static registerInjections = (container: DependencyContainer): void => {
        container.registerSingleton(SmsChannel);
        container.registerSingleton(EmailChannel);
        container.registerSingleton(PushChannel);
        container.registerSingleton(WhatsAppChannel);
        container.registerSingleton(NotificationService);
    };
}
