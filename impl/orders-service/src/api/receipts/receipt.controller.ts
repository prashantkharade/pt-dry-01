import crypto from 'node:crypto';
import express from 'express';
import { container } from 'tsyringe';
import { OrderService } from '../../database/typeorm/services/order.service';
import { IdentityServiceConnector } from '../../modules/identity/identity.service.connector';
import { ReceiptGenerator } from '../../modules/receipts/receipt.generator';
import { ConfigurationManager } from '../../config/configuration.manager';
import { ResponseHandler } from '../../common/handlers/response.handler';
import { ErrorHandler } from '../../common/api.error';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Receipt download.
//
//  Two doors, deliberately:
//
//  1) GET /receipts/:orderId.pdf — for a signed-in user. Normal auth, and
//     the caller must own the order (or be staff).
//
//  2) GET /receipts/public/:orderId.pdf?token=... — for the link we put in
//     a WhatsApp/SMS message. There is no session in WhatsApp, so the link
//     itself must carry the authority. The token is an HMAC over the order
//     id and an expiry, signed with a server secret: unguessable, tamper-
//     evident, and it dies on its own. Without an expiry a leaked link is
//     permanent access to someone's invoice.
/////////////////////////////////////////////////////////////////////////

//A receipt link should outlive the conversation but not the customer.
const LINK_TTL_DAYS = 30;

export class ReceiptController {

    private _orders    = container.resolve(OrderService);
    private _identity  = container.resolve(IdentityServiceConnector);
    private _generator = container.resolve(ReceiptGenerator);

    /**
     * Sign a receipt link.
     *
     * Static so notification-sending code can build a URL without going
     * through the controller.
     */
    public static signToken = (orderId: string, expiresAtMs: number): string => {
        const secret = ConfigurationManager.getEnv('RECEIPT_LINK_SECRET', ConfigurationManager.getEnv('JWT_SECRET'));
        const mac = crypto.createHmac('sha256', secret).update(`${orderId}.${expiresAtMs}`).digest('hex');
        //The expiry travels with the signature and is covered BY it — a
        //client that edits the expiry invalidates the MAC.
        return `${expiresAtMs}.${mac}`;
    };

    public static publicUrl = (orderId: string): string => {
        const base = ConfigurationManager.getEnv('PUBLIC_BASE_URL', ConfigurationManager.getEnv('BASE_URL', 'http://localhost:4003'));
        const expiresAt = Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000;
        return `${base}/api/v1/receipts/public/${orderId}.pdf?token=${ReceiptController.signToken(orderId, expiresAt)}`;
    };

    private static verifyToken = (orderId: string, token: string): boolean => {
        const [expiresRaw, mac] = String(token).split('.');
        const expiresAt = Number(expiresRaw);
        if (!Number.isFinite(expiresAt) || !mac) return false;
        if (Date.now() > expiresAt) return false;

        const expected = ReceiptController.signToken(orderId, expiresAt).split('.')[1];
        if (expected.length !== mac.length) return false;
        //Constant-time: a plain !== leaks the signature a byte at a time to
        //anyone who can measure our latency.
        try {
            return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(mac, 'utf8'));
        } catch {
            return false;
        }
    };

    private stream = async (
        response: express.Response,
        tenantId: string,
        orderId : string,
    ): Promise<void> => {
        const order = await this._orders.getById(tenantId, orderId);
        if (!order) ErrorHandler.throwNotFoundError('Order not found');

        const doc = this._generator.render({
            Order: order,
            Lines: order.Lines ?? [],
        });

        response.setHeader('Content-Type', 'application/pdf');
        //`inline` so a phone opens it in the browser's viewer instead of
        //dumping a file into Downloads. The filename is used if they do save.
        response.setHeader('Content-Disposition', `inline; filename="${order.OrderCode}.pdf"`);
        //A receipt for a delivered order never changes; let the phone cache it.
        response.setHeader('Cache-Control', 'private, max-age=3600');

        doc.pipe(response);
    };

    //  GET /receipts/:orderId.pdf — signed-in download.
    public download = async (request: express.Request, response: express.Response): Promise<void> => {
        try {
            const u  = request.currentUser;
            const id = String(request.params.orderId).replace(/\.pdf$/, '');

            //Staff may pull any receipt in their tenant; a customer only their own.
            const isOps = u.Roles.some((r) => r === 'SystemAdmin' || r === 'Receptionist');
            if (!isOps) {
                const token = request.headers.authorization?.slice('Bearer '.length).trim() ?? '';
                const me = await this._identity.getMyCustomer(token);
                const order = await this._orders.getById(u.TenantId, id);
                if (!order || !me || order.CustomerId !== me.id) {
                    ErrorHandler.throwNotFoundError('Order not found');
                }
            }
            await this.stream(response, u.TenantId, id);
        } catch (error) {
            ResponseHandler.handleError(request, response, error);
        }
    };

    //  GET /receipts/public/:orderId.pdf?token=... — the link in a WhatsApp
    //  message. No session; the signed token IS the authority.
    public publicDownload = async (request: express.Request, response: express.Response): Promise<void> => {
        try {
            const id    = String(request.params.orderId).replace(/\.pdf$/, '');
            const token = String(request.query.token ?? '');

            if (!ReceiptController.verifyToken(id, token)) {
                logger.warn(`Receipt link rejected for order=${id} from ${request.ip}`);
                //410, not 401: the usual cause is an expired link, and "gone"
                //tells the customer to ask for a fresh one rather than
                //implying they typed a password wrong.
                response.status(410).send('This receipt link has expired or is invalid. Please request a new one.');
                return;
            }

            //The token proves which order, but not which tenant. Resolve the
            //tenant from the order itself rather than trusting the caller.
            const tenantId = await this._orders.tenantOf(id);
            if (!tenantId) {
                response.status(404).send('Receipt not found');
                return;
            }
            await this.stream(response, tenantId, id);
        } catch (error) {
            logger.error(`Public receipt failed: ${(error as Error)?.message}`);
            response.status(500).send('Could not generate the receipt');
        }
    };
}
