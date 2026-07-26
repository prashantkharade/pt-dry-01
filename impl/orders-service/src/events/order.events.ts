import { EventEmitter } from 'node:events';
import IORedis from 'ioredis';
import { ConfigurationManager } from '../config/configuration.manager';
import { logger } from '../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Live order events.
//
//  Two audiences, one stream:
//    - staff watch every order in the tenant ("a pickup just came in")
//    - a customer watches their own order move ("out for delivery")
//
//  Fan-out goes through Redis pub/sub rather than a bare EventEmitter,
//  because SSE connections are pinned to one instance: a customer's browser
//  might be held by instance A while the status change happens on instance
//  B. An in-process emitter would deliver to nobody. Redis makes every
//  instance see every event and push it to whichever clients it holds.
//
//  Delivery is best-effort and NOT durable. That is deliberate — this is a
//  live view, not a notification. Anything that must reach the customer
//  goes through notifications-service, which is queued and retried. If a
//  browser misses an event it re-reads the order on reconnect.
/////////////////////////////////////////////////////////////////////////

export const ORDER_EVENTS_CHANNEL = 'ptk:order-events';

export type OrderEventType =
    | 'order.created'
    | 'order.status'
    | 'delivery.assigned'
    | 'delivery.run'
    | 'payment.captured';

export interface OrderEvent {
    Type      : OrderEventType;
    TenantId  : string;
    OrderId   : string;
    OrderCode : string;
    //Present when the event belongs to one customer — lets the SSE endpoint
    //filter a customer's stream down to their own orders.
    CustomerId?: string;
    Status?   : string;
    Title     : string;
    Detail?   : string;
    At        : string;
    Data?     : Record<string, unknown>;
}

class OrderEventBus {

    //Local listeners: the SSE handlers on THIS instance.
    private _local = new EventEmitter();
    private _pub: IORedis | null = null;
    private _sub: IORedis | null = null;
    private _connected = false;

    constructor() {
        //An SSE endpoint per connected browser; the default cap of 10 would
        //start printing leak warnings on a busy shop floor.
        this._local.setMaxListeners(0);
    }

    public connect = (): void => {
        const url = ConfigurationManager.getEnvOptional('REDIS_URL');
        if (!url) {
            //Single instance in dev: the local emitter alone is correct, since
            //the publisher and the SSE connection are the same process.
            logger.warn('REDIS_URL not set — live order events stay in-process. Fine for one instance; breaks fan-out across replicas.');
            return;
        }
        //Two connections: a Redis client in subscribe mode cannot issue any
        //other command, so publishing needs its own.
        this._pub = new IORedis(url, { maxRetriesPerRequest: 2 });
        this._sub = new IORedis(url, { maxRetriesPerRequest: null });

        this._pub.on('error', (e) => logger.error(`order-events pub error: ${e.message}`));
        this._sub.on('error', (e) => logger.error(`order-events sub error: ${e.message}`));

        this._sub.subscribe(ORDER_EVENTS_CHANNEL, (err) => {
            if (err) { logger.error(`order-events subscribe failed: ${err.message}`); return; }
            this._connected = true;
            logger.info('Live order events connected via Redis pub/sub');
        });
        this._sub.on('message', (_channel, payload) => {
            try {
                this._local.emit('event', JSON.parse(payload) as OrderEvent);
            } catch (e: any) {
                logger.warn(`order-events: bad payload dropped: ${e?.message}`);
            }
        });
    };

    /**
     * Publish an event.
     *
     * Never throws: an order must not fail because the live view is down.
     */
    public publish = async (event: OrderEvent): Promise<void> => {
        try {
            if (this._pub && this._connected) {
                //Redis echoes back to our own subscriber, so we do NOT also
                //emit locally — that would deliver the event twice.
                await this._pub.publish(ORDER_EVENTS_CHANNEL, JSON.stringify(event));
            } else {
                this._local.emit('event', event);
            }
        } catch (error: any) {
            logger.warn(`order-events publish failed: ${error?.message}`);
        }
    };

    public subscribe = (handler: (e: OrderEvent) => void): (() => void) => {
        this._local.on('event', handler);
        //Returned so the SSE handler can detach on disconnect — without this
        //every closed browser tab leaks a listener.
        return () => this._local.off('event', handler);
    };

    public shutdown = async (): Promise<void> => {
        this._sub?.disconnect();
        this._pub?.disconnect();
        this._local.removeAllListeners();
    };
}

export const OrderEvents = new OrderEventBus();
