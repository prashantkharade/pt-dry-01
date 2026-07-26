import express from 'express';
import { container } from 'tsyringe';
import { OrderEvents, OrderEvent } from '../../events/order.events';
import { IdentityServiceConnector } from '../../modules/identity/identity.service.connector';
import { logger } from '../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Live order stream (Server-Sent Events).
//
//  SSE rather than WebSockets: the traffic is one-way (server → browser),
//  it is plain HTTP so it inherits our existing auth and passes through
//  proxies untouched, and EventSource reconnects on its own. A WebSocket
//  would buy nothing here and cost a second auth path.
//
//  Two views onto the same bus:
//    staff    — every event in their tenant (the shop's live board)
//    customer — only events for their own orders
//  The filter is applied server-side, per connection: a customer must never
//  be handed another customer's order simply because they opened a stream.
/////////////////////////////////////////////////////////////////////////

//Proxies and load balancers cut idle connections. A comment line every 25s
//keeps the socket warm without producing a client-visible event.
const HEARTBEAT_MS = 25_000;

export class EventsController {

    private _identity = container.resolve(IdentityServiceConnector);

    public stream = async (request: express.Request, response: express.Response): Promise<void> => {
        const user  = request.currentUser;
        const isOps = user.Roles.some((r) => r === 'SystemAdmin' || r === 'Receptionist');

        //  Staff may narrow to one customer via ?CustomerId=.
        //  A customer is pinned to their OWN id, resolved from their token —
        //  never from the query string. Honouring a client-supplied id here
        //  would let anyone stream anyone else's orders in real time.
        const token = request.headers.authorization?.slice('Bearer '.length).trim() ?? '';
        const customerFilter = isOps
            ? (request.query.CustomerId as string | undefined)
            : (await this._identity.getMyCustomer(token).catch(() => null))?.id;

        if (!isOps && !customerFilter) {
            //No customer profile and not staff: there is nothing this caller
            //could legitimately watch.
            response.status(404).json({ Status: 'failure', Message: 'No customer profile for this user' });
            return;
        }

        response.writeHead(200, {
            'Content-Type'     : 'text/event-stream',
            'Cache-Control'    : 'no-cache, no-transform',
            Connection         : 'keep-alive',
            //nginx buffers proxied responses by default, which holds events
            //until the buffer fills — i.e. it silently breaks SSE.
            'X-Accel-Buffering': 'no',
        });
        response.flushHeaders();

        const send = (event: string, data: unknown) => {
            response.write(`event: ${event}\n`);
            response.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        //Tell the client we're live, and how long to wait before retrying if
        //the connection drops.
        response.write('retry: 5000\n\n');
        send('ready', { Ops: isOps, At: new Date().toISOString() });

        const visible = (e: OrderEvent): boolean => {
            if (e.TenantId !== user.TenantId) return false;
            if (isOps) {
                //Staff may narrow to one customer, but see everything by default.
                return !customerFilter || e.CustomerId === customerFilter;
            }
            //Customer: their own orders only, never anyone else's.
            return Boolean(e.CustomerId) && e.CustomerId === customerFilter;
        };

        const unsubscribe = OrderEvents.subscribe((e) => {
            if (!visible(e)) return;
            try {
                send(e.Type, e);
            } catch (error: any) {
                logger.warn(`SSE write failed, dropping client: ${error?.message}`);
            }
        });

        const heartbeat = setInterval(() => {
            //A comment line: keeps the connection alive, and EventSource
            //ignores it rather than firing a message.
            response.write(': ping\n\n');
        }, HEARTBEAT_MS);

        //Detach on disconnect. Without this every closed tab leaks a listener
        //and an interval, and the process slowly dies.
        const cleanup = () => {
            clearInterval(heartbeat);
            unsubscribe();
        };
        request.on('close', cleanup);
        request.on('error', cleanup);
    };
}
