import { injectable } from 'tsyringe';
import * as nodemailer from 'nodemailer';
import { ConfigurationManager } from '../../config/configuration.manager';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  SMTP email channel via nodemailer. As with SMS, when SMTP isn't
//  configured the channel logs and short-circuits.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class EmailChannel {

    private transporter: nodemailer.Transporter | null = null;

    private getTransport(): nodemailer.Transporter | null {
        if (this.transporter) return this.transporter;
        const host = ConfigurationManager.getEnvOptional('SMTP_HOST');
        if (!host) return null;
        this.transporter = nodemailer.createTransport({
            host,
            port: Number(ConfigurationManager.getEnvOptional('SMTP_PORT') ?? '587'),
            secure: ConfigurationManager.getEnvBool('SMTP_SECURE', false),
            auth: {
                user: ConfigurationManager.getEnv('SMTP_USER'),
                pass: ConfigurationManager.getEnv('SMTP_PASS'),
            },
        });
        return this.transporter;
    }

    public send = async (to: string, subject: string, body: string): Promise<{ MessageId?: string }> => {
        const transport = this.getTransport();
        if (!transport) {
            logger.warn(`EmailChannel (stub): would send to=${to} subject="${subject}"`);
            return {};
        }
        const info = await transport.sendMail({
            from: ConfigurationManager.getEnv('SMTP_FROM', 'noreply@ptkharade.in'),
            to,
            subject,
            text: body,
        });
        return { MessageId: info.messageId };
    };
}
