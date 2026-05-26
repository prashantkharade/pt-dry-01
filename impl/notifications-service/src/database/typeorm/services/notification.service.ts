import { injectable, inject } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { NotificationTemplate } from '../models/notification.template.model';
import { NotificationLog } from '../models/notification.log.model';
import { BaseService } from './base.service';
import { SmsChannel } from '../../../modules/channels/sms.channel';
import { EmailChannel } from '../../../modules/channels/email.channel';
import { PushChannel } from '../../../modules/channels/push.channel';
import { WhatsAppChannel } from '../../../modules/channels/whatsapp.channel';
import { ErrorHandler } from '../../../common/api.error';

/////////////////////////////////////////////////////////////////////////
//  NotificationService — single entrypoint to dispatch a notification
//  through any channel, persist the log row, and surface the
//  send/failure outcome.
/////////////////////////////////////////////////////////////////////////

export type Channel = 'SMS' | 'Email' | 'WhatsApp' | 'Push' | 'InApp';

export interface SendNotificationInput {
    TenantId      : string;
    Channel       : Channel;
    Recipient     : string;
    Subject?      : string;
    Body          : string;
    TemplateCode? : string;
}

@injectable()
export class NotificationService extends BaseService {

    constructor(
        @inject(SmsChannel)      private _sms:    SmsChannel,
        @inject(EmailChannel)    private _email:  EmailChannel,
        @inject(PushChannel)     private _push:   PushChannel,
        @inject(WhatsAppChannel) private _wa:     WhatsAppChannel,
    ) {
        super();
    }

    private _logRepo      = Source.getRepository(NotificationLog);
    private _templateRepo = Source.getRepository(NotificationTemplate);

    public renderTemplate = async (
        tenantId: string,
        code    : string,
        vars    : Record<string, string | number>,
        language: string = 'en',
    ): Promise<{ Subject?: string; Body: string }> => {
        const tpl = await this._templateRepo.findOne({
            where: { TenantId: tenantId, Code: code, Language: language, IsActive: true },
        });
        if (!tpl) ErrorHandler.throwNotFoundError(`Template not found: ${code}/${language}`);
        const apply = (raw: string) =>
            Object.entries(vars).reduce((acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v)), raw);
        return { Subject: tpl.Subject ? apply(tpl.Subject) : undefined, Body: apply(tpl.Body) };
    };

    public send = async (input: SendNotificationInput): Promise<NotificationLog> => {
        const log = await this._logRepo.save(this._logRepo.create({
            TenantId    : input.TenantId,
            Channel     : input.Channel,
            TemplateCode: input.TemplateCode,
            Recipient   : input.Recipient,
            Subject     : input.Subject,
            Body        : input.Body,
            Status      : 'Queued',
        }));

        try {
            let result: { MessageId?: string } = {};
            switch (input.Channel) {
                case 'SMS'     : result = await this._sms.send(input.Recipient, input.Body); break;
                case 'Email'   : result = await this._email.send(input.Recipient, input.Subject ?? '', input.Body); break;
                case 'Push'    : result = await this._push.send(input.Recipient, input.Subject ?? '', input.Body); break;
                case 'WhatsApp': result = await this._wa.send(input.Recipient, input.Body); break;
                case 'InApp'   : break;
            }
            log.Status            = 'Sent';
            log.ProviderMessageId = result.MessageId;
            return this._logRepo.save(log);
        } catch (e: any) {
            log.Status        = 'Failed';
            log.FailureReason = e?.message?.slice(0, 512) ?? 'Unknown error';
            return this._logRepo.save(log);
        }
    };
}
