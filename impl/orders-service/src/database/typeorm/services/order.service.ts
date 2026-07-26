import { injectable, inject } from 'tsyringe';
import { SelectQueryBuilder } from 'typeorm';
import { Source } from '../typeorm.database.connector';
import { Order } from '../models/order.model';
import { OrderItem } from '../models/order.item.model';
import { OrderStatusHistory } from '../models/order.status.history.model';
import { BaseService } from './base.service';
import { OrderMapper } from '../mappers/order.mapper';
import {
    OrderCreateModel, OrderDto, OrderSearchFilters, OrderSummaryDto,
} from '../../../domain.types/orders/order.types';
import {
    OrderStatus, BilledTo, OrderDeliveryType, OrderChannel, ORDER_STATUS_TRANSITIONS,
} from '../../../domain.types/enums/order.enums';
import { BaseSearchResults } from '../../../domain.types/miscellaneous/search.types';
import { ErrorHandler } from '../../../common/api.error';
import { StringUtils } from '../../../common/utilities/string.utils';
import { resolveRange, eachDay } from '../../../common/utilities/date.range';
import { ConfigurationManager } from '../../../config/configuration.manager';
import { IdentityServiceConnector } from '../../../modules/identity/identity.service.connector';
import { CatalogPricingServiceConnector } from '../../../modules/catalog.pricing/catalog.pricing.service.connector';
import { SlotBookingService } from './slot.booking.service';
import { DeliveryAssignmentService } from './delivery.assignment.service';
import { NotificationsServiceConnector } from '../../../modules/notifications/notifications.service.connector';
import { OrderEvents } from '../../../events/order.events';
import { ReceiptController } from '../../../api/receipts/receipt.controller';
import { DeliveryDirection } from '../../../domain.types/enums/delivery.enums';
import { DeliverySlot } from '../models/delivery.slot.model';
import { DeliveryPartner } from '../models/delivery.partner.model';
import {
    TrackingDto, TrackingLeg, TrackingStep, TrackingStepState, buildSteps,
} from '../../../domain.types/orders/tracking.types';
import { logger } from '../../../logger/logger';

/////////////////////////////////////////////////////////////////////////
//  Application service for Order. Composes pricing (via catalog-pricing)
//  and customer lookup (via identity-service), persists the aggregate,
//  and enforces the status-transition state machine.
//
//  Also owns the link to the delivery domain: an order books a seat in a
//  pickup slot and/or a delivery slot as part of the SAME transaction that
//  writes the order, so a failed order can never leave capacity held.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class OrderService extends BaseService {

    constructor(
        @inject(IdentityServiceConnector)        private _identity: IdentityServiceConnector,
        @inject(CatalogPricingServiceConnector)  private _pricing:  CatalogPricingServiceConnector,
        @inject(SlotBookingService)              private _slots:    SlotBookingService,
        @inject(DeliveryAssignmentService)       private _runs:     DeliveryAssignmentService,
        @inject(NotificationsServiceConnector)   private _notify:   NotificationsServiceConnector,
    ) {
        super();
    }

    private _orderRepo   = Source.getRepository(Order);
    private _lineRepo    = Source.getRepository(OrderItem);
    private _historyRepo = Source.getRepository(OrderStatusHistory);
    private _slotRepo    = Source.getRepository(DeliverySlot);
    private _partnerRepo = Source.getRepository(DeliveryPartner);

    /**
     * Which legs this order needs, derived from Channel + DeliveryType.
     * Kept in one place so creation, validation and cancellation agree.
     */
    private legsFor = (input: OrderCreateModel): DeliveryDirection[] => {
        const legs: DeliveryDirection[] = [];
        if (input.Channel === OrderChannel.HomePickup)              legs.push(DeliveryDirection.Pickup);
        if (input.DeliveryType === OrderDeliveryType.HomeDelivery)  legs.push(DeliveryDirection.Delivery);
        return legs;
    };

    private assertLegInputs = (input: OrderCreateModel): void => {
        const legs = this.legsFor(input);
        const missing: string[] = [];
        if (legs.includes(DeliveryDirection.Pickup) && (!input.PickupSlotId || !input.PickupDate)) {
            missing.push('PickupSlotId and PickupDate are required when Channel is HomePickup');
        }
        if (legs.includes(DeliveryDirection.Delivery) && (!input.DeliverySlotId || !input.DeliveryDate)) {
            missing.push('DeliverySlotId and DeliveryDate are required when DeliveryType is HomeDelivery');
        }
        //Without a society we cannot resolve a zone, so no partner can ever be
        //auto-assigned and the order silently sits unassigned. Fail loudly now.
        if (legs.length > 0 && !input.SocietyId) {
            missing.push('SocietyId is required when the order has a pickup or delivery leg');
        }
        if (missing.length) ErrorHandler.throwInputValidationError(missing);
    };

    public create = async (
        input        : OrderCreateModel,
        currentUserId: string,
        accessToken  : string,
    ): Promise<OrderDto> => {
        this.assertLegInputs(input);

        const customer = await this._identity.getCustomer(input.CustomerId, accessToken);
        const isVendor = customer.CustomerType === 'Vendor';

        const quote = await this._pricing.quote({
            ServiceTypeCode : input.ServiceTypeCode,
            IsVendor        : isVendor,
            IsExpress       : !!input.IsExpress,
            DeliveryType    : input.DeliveryType,
            Items           : input.Items.map((i) => ({ ItemId: i.ItemId, Quantity: i.Quantity })),
        }, accessToken);

        const saved = await Source.transaction(async (manager) => {
            //Take the seats FIRST, inside this transaction. If the slot is full
            //we throw here and nothing is written; if the order write fails
            //below, the reservations roll back with it. Either way capacity and
            //orders cannot disagree.
            const pickupBooking = input.PickupSlotId
                ? await this._slots.reserve({
                    TenantId    : customer.TenantId,
                    BranchId    : customer.BranchId,
                    SlotId      : input.PickupSlotId,
                    BookingDate : input.PickupDate,
                    Direction   : DeliveryDirection.Pickup,
                }, manager)
                : null;

            const deliveryBooking = input.DeliverySlotId
                ? await this._slots.reserve({
                    TenantId    : customer.TenantId,
                    BranchId    : customer.BranchId,
                    SlotId      : input.DeliverySlotId,
                    BookingDate : input.DeliveryDate,
                    Direction   : DeliveryDirection.Delivery,
                }, manager)
                : null;

            const order = manager.create(Order, {
                TenantId          : customer.TenantId,
                BranchId          : customer.BranchId,
                OrderCode         : StringUtils.generateOrderCode(),
                CustomerId        : customer.id,
                CustomerName      : customer.Name,
                CustomerPhone     : customer.Phone ?? '',
                BilledTo          : input.BilledTo ?? (isVendor ? BilledTo.Vendor : BilledTo.Customer),
                ServiceTypeCode   : input.ServiceTypeCode,
                Channel           : input.Channel ?? OrderChannel.DropAtShop,
                DeliveryType      : input.DeliveryType ?? OrderDeliveryType.CustomerPickup,
                IsExpress         : !!input.IsExpress,
                Status            : OrderStatus.Booked,
                ScheduledAt       : input.ScheduledAt ? new Date(input.ScheduledAt) : null,
                DeliveryAddressId : input.DeliveryAddressId,
                SocietyId             : input.SocietyId,
                PickupSlotBookingId   : pickupBooking?.id ?? null,
                DeliverySlotBookingId : deliveryBooking?.id ?? null,
                SubtotalInr       : String(quote.SubtotalInr),
                DeliveryChargeInr : String(quote.DeliveryChargeInr),
                ExpressChargeInr  : String(quote.ExpressChargeInr),
                GstInr            : String(quote.GstInr),
                TotalInr          : String(quote.TotalInr),
                Notes             : input.Notes,
                CreatedBy         : currentUserId,
            });
            const persisted = await manager.save(order);

            const lines = quote.Lines.map((line, idx) =>
                manager.create(OrderItem, {
                    OrderId         : persisted.id,
                    ItemId          : line.ItemId,
                    ItemCode        : line.ItemCode,
                    ItemName        : line.ItemName,
                    ServiceTypeCode : input.ServiceTypeCode,
                    Quantity        : line.Quantity,
                    UnitRateInr     : String(line.UnitRateInr),
                    LineTotalInr    : String(line.LineTotalInr),
                    Note            : input.Items[idx]?.Note,
                }),
            );
            await manager.save(lines);

            //Now that the order row exists, tie the seats to it. Same
            //transaction, so a booking can never point at an order that
            //isn't there.
            for (const b of [pickupBooking, deliveryBooking]) {
                if (!b) continue;
                b.OrderId     = persisted.id;
                b.ConfirmedAt = new Date();
                await manager.save(b);
            }

            await manager.save(manager.create(OrderStatusHistory, {
                OrderId   : persisted.id,
                FromStatus: null,
                ToStatus  : OrderStatus.Booked,
                ChangedBy : currentUserId,
                Note      : 'Order created',
            }));
            return persisted;
        });

        //Assign partners AFTER the order is committed, and never let it fail
        //the booking: "no partner covers this zone yet" is an ops problem to
        //solve on the board, not a reason to reject a paying customer.
        await this.autoAssignLegs(saved.id, saved.TenantId, input);

        //Tell the customer, and light up the shop's live board. Both are
        //fire-and-forget for the same reason as auto-assign: the order is
        //already committed and must not be undone by a notification failure.
        void this.announceCreated(saved, customer);

        return this.getById(saved.TenantId, saved.id);
    };

    /**
     * The "when are you coming" line on the receipt.
     *
     * Assembled here rather than in the template because it depends on which
     * legs the order actually has — and a receipt that says "Pickup: —" for a
     * walk-in customer reads like a bug.
     */
    private legLine = async (order: Order): Promise<string> => {
        const parts: string[] = [];
        for (const [bookingId, label] of [
            [order.PickupSlotBookingId, 'Pickup'] as const,
            [order.DeliverySlotBookingId, 'Delivery'] as const,
        ]) {
            if (!bookingId) continue;
            const booking = await this._slots.getById(bookingId);
            if (!booking) continue;
            const slot = await this._slotRepo.findOne({ where: { id: booking.SlotId } });
            const window = slot ? `${String(slot.StartTime).slice(0, 5)}-${String(slot.EndTime).slice(0, 5)}` : '';
            parts.push(`*${label}:* ${booking.BookingDate} ${window}`.trim());
        }
        if (parts.length) return parts.join('\n');
        return order.DeliveryType === OrderDeliveryType.HomeDelivery
            ? 'We will deliver to you.'
            : 'Please collect from the shop when ready.';
    };

    /**
     * Order placed: receipt to the customer, alert to the shop.
     *
     * WhatsApp carries the itemised receipt; SMS is the fallback that works on
     * every phone; push reaches the app. All three are queued and retried by
     * notifications-service, so this only has to hand them over.
     */
    private announceCreated = async (order: Order, customer: { Phone?: string; Email?: string; PreferredLanguage?: string }): Promise<void> => {
        const language = (customer.PreferredLanguage === 'mr' ? 'mr' : 'en') as 'en' | 'mr';
        const lines = await this._lineRepo.find({ where: { OrderId: order.id } });

        const variables = {
            Name        : order.CustomerName,
            OrderCode   : order.OrderCode,
            Total       : order.TotalInr,
            ServiceType : order.ServiceTypeCode,
            ItemCount   : lines.reduce((n, l) => n + (l.Quantity ?? 0), 0),
            //Signed, expiring links: WhatsApp has no session to authenticate
            //against, so the link itself has to carry the authority.
            ReceiptUrl  : ReceiptController.publicUrl(order.id),
            TrackUrl    : `${ConfigurationManager.getEnv('PUBLIC_APP_URL', 'https://app.ptkharade.in')}/track/${order.OrderCode}`,
            LegLine     : await this.legLine(order),
        };

        if (order.CustomerPhone) {
            await this._notify.fanOut(
                { TenantId: order.TenantId, Code: 'ORDER_BOOKED', Recipient: order.CustomerPhone, Language: language, Variables: variables },
                //WhatsApp carries the itemised receipt; SMS is the fallback
                //that works on any phone, including one with no data.
                ['WhatsApp', 'SMS'],
            );
        }
        if (customer.Email) {
            await this._notify.send({
                TenantId: order.TenantId, Code: 'ORDER_BOOKED', Channel: 'Email',
                Recipient: customer.Email, Language: language, Variables: variables,
            });
        }

        //The shop's live board. A pickup booked from the app is work that just
        //appeared with nobody watching for it, so staff need to see it land.
        await OrderEvents.publish({
            Type      : 'order.created',
            TenantId  : order.TenantId,
            OrderId   : order.id,
            OrderCode : order.OrderCode,
            CustomerId: order.CustomerId,
            Status    : order.Status,
            Title     : `New ${order.Channel === OrderChannel.HomePickup ? 'pickup' : 'order'}: ${order.OrderCode}`,
            Detail    : `${order.CustomerName} · ${order.ServiceTypeCode} · Rs.${order.TotalInr}`,
            At        : new Date().toISOString(),
            Data      : { Channel: order.Channel, DeliveryType: order.DeliveryType, TotalInr: order.TotalInr },
        });
    };

    private autoAssignLegs = async (orderId: string, tenantId: string, input: OrderCreateModel): Promise<void> => {
        if (!input.SocietyId) return;
        const order = await this._orderRepo.findOne({ where: { id: orderId } });
        if (!order) return;

        const legs: Array<[DeliveryDirection, string]> = [];
        if (order.PickupSlotBookingId)   legs.push([DeliveryDirection.Pickup,   order.PickupSlotBookingId]);
        if (order.DeliverySlotBookingId) legs.push([DeliveryDirection.Delivery, order.DeliverySlotBookingId]);

        for (const [direction, bookingId] of legs) {
            try {
                const result = await this._runs.autoAssign({
                    TenantId : tenantId, OrderId: orderId, Direction: direction,
                    SocietyId: input.SocietyId, BookingId: bookingId,
                });
                if (!result.Assigned) {
                    logger.warn(`Order ${order.OrderCode} ${direction} leg unassigned: ${result.Reason}`);
                }
            } catch (error: any) {
                logger.error(`Auto-assign failed for order ${order.OrderCode} ${direction}: ${error?.message}`);
            }
        }
    };

    /**
     * The tenant that owns an order.
     *
     * Needed by the public (signed-link) receipt route: the token proves which
     * ORDER may be read, but carries no tenant, and taking one from the request
     * would let a caller read across tenants.
     */
    public tenantOf = async (orderId: string): Promise<string | null> => {
        const row = await this._orderRepo.findOne({ where: { id: orderId }, select: { TenantId: true } });
        return row?.TenantId ?? null;
    };

    public getById = async (tenantId: string, id: string): Promise<OrderDto> => {
        const order = await this._orderRepo.findOne({ where: { id, TenantId: tenantId } });
        if (!order) return null;
        const lines   = await this._lineRepo.find({ where: { OrderId: id } });
        const history = await this._historyRepo.find({ where: { OrderId: id }, order: { CreatedAt: 'ASC' } });
        return OrderMapper.toDto(order, lines, history);
    };

    /**
     * Build the WHERE clause shared by list() and summary().
     *
     * One place, so a filtered list and its totals can never disagree — a
     * dashboard whose count doesn't match its own table is worse than no
     * dashboard.
     */
    private applyFilters = (qb: SelectQueryBuilder<Order>, filters: OrderSearchFilters): SelectQueryBuilder<Order> => {
        qb.where('o."TenantId" = :t', { t: filters.TenantId })
          .andWhere('o."DeletedAt" IS NULL');

        if (filters.Status)          qb.andWhere('o."Status" = :s', { s: filters.Status });
        if (filters.CustomerId)      qb.andWhere('o."CustomerId" = :c', { c: filters.CustomerId });
        if (filters.ServiceTypeCode) qb.andWhere('o."ServiceTypeCode" = :st', { st: filters.ServiceTypeCode });
        if (filters.Channel)         qb.andWhere('o."Channel" = :ch', { ch: filters.Channel });
        if (filters.DeliveryType)    qb.andWhere('o."DeliveryType" = :dt', { dt: filters.DeliveryType });
        if (filters.BilledTo)        qb.andWhere('o."BilledTo" = :bt', { bt: filters.BilledTo });
        if (filters.IsExpress !== undefined) qb.andWhere('o."IsExpress" = :ex', { ex: filters.IsExpress });

        //Half-open [From, To). See date.range.ts for why the end is exclusive.
        const range = resolveRange(filters);
        if (range) {
            qb.andWhere('o."CreatedAt" >= :from AND o."CreatedAt" < :to', { from: range.From, to: range.To });
        }

        if (filters.Query) {
            qb.andWhere('(o."OrderCode" ILIKE :q OR o."CustomerName" ILIKE :q OR o."CustomerPhone" ILIKE :q)', {
                q: `%${filters.Query}%`,
            });
        }
        return qb;
    };

    public list = async (filters: OrderSearchFilters): Promise<BaseSearchResults<OrderDto>> => {
        const qb = this.applyFilters(this._orderRepo.createQueryBuilder('o'), filters);

        const pageIndex = this.pageIndex(filters.PageIndex);
        const pageSize  = this.pageSize(filters.ItemsPerPage);

        //Whitelisted, never interpolated from the request — a sort column is a
        //SQL identifier and cannot be parameterised, so an unchecked one is an
        //injection point.
        const sortable = ['CreatedAt', 'TotalInr', 'OrderCode', 'Status'];
        const sortBy   = sortable.includes(filters.SortBy ?? '') ? filters.SortBy! : 'CreatedAt';
        const sortDir  = filters.SortOrder === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(`o."${sortBy}"`, sortDir).skip(pageIndex * pageSize).take(pageSize);
        const [items, total] = await qb.getManyAndCount();
        return { Items: items.map((o) => OrderMapper.toDto(o)), Total: total, PageIndex: pageIndex, ItemsPerPage: pageSize };
    };

    /**
     * Aggregates over the SAME filters as list(), for the dashboard.
     *
     * Computed in SQL rather than by pulling rows and reducing in Node: at
     * year-scale that would drag the whole order table over the wire to count it.
     */
    public summary = async (filters: OrderSearchFilters): Promise<OrderSummaryDto> => {
        const base = () => this.applyFilters(this._orderRepo.createQueryBuilder('o'), filters);

        const totals = await base()
            .select('COUNT(*)', 'count')
            //Cancelled orders were never revenue. Counting them inflates every
            //takings figure on the dashboard.
            .addSelect(`COALESCE(SUM(CASE WHEN o."Status" <> :cancelled THEN o."TotalInr" ELSE 0 END), 0)`, 'revenue')
            .setParameter('cancelled', OrderStatus.Cancelled)
            .getRawOne<{ count: string; revenue: string }>();

        const byStatus = await base()
            .select('o."Status"', 'k').addSelect('COUNT(*)', 'n').groupBy('o."Status"')
            .getRawMany<{ k: string; n: string }>();

        const byService = await base()
            .select('o."ServiceTypeCode"', 'k').addSelect('COUNT(*)', 'n').groupBy('o."ServiceTypeCode"')
            .getRawMany<{ k: string; n: string }>();

        //Bucket by the shop's local day, not UTC — otherwise an evening order
        //in IST lands in tomorrow's bucket.
        const trendRows = await base()
            .select(`to_char(o."CreatedAt" AT TIME ZONE :tz, 'YYYY-MM-DD')`, 'd')
            .addSelect('COUNT(*)', 'n')
            .addSelect(`COALESCE(SUM(CASE WHEN o."Status" <> :cancelled THEN o."TotalInr" ELSE 0 END), 0)`, 'revenue')
            .setParameter('tz', ConfigurationManager.getEnv('SHOP_TIMEZONE', 'Asia/Kolkata'))
            .setParameter('cancelled', OrderStatus.Cancelled)
            .groupBy('d').orderBy('d', 'ASC')
            .getRawMany<{ d: string; n: string; revenue: string }>();

        //Fill the gaps: a chart that skips quiet days draws a misleading line.
        const range = resolveRange(filters);
        const found = new Map(trendRows.map((r) => [r.d, r]));
        const days  = range ? eachDay(range) : trendRows.map((r) => r.d);

        return {
            Total        : Number(totals?.count ?? 0),
            RevenueInr   : Number(totals?.revenue ?? 0).toFixed(2),
            ByStatus     : Object.fromEntries(byStatus.map((r) => [r.k, Number(r.n)])),
            ByServiceType: Object.fromEntries(byService.map((r) => [r.k, Number(r.n)])),
            Trend        : days.map((d) => ({
                Date      : d,
                Count     : Number(found.get(d)?.n ?? 0),
                RevenueInr: Number(found.get(d)?.revenue ?? 0).toFixed(2),
            })),
        };
    };

    public updateStatus = async (
        tenantId    : string,
        id          : string,
        nextStatus  : OrderStatus,
        actorUserId : string,
        actorName   : string,
        note?       : string,
    ): Promise<OrderDto> => {
        const order = await this._orderRepo.findOne({ where: { id, TenantId: tenantId } });
        if (!order) ErrorHandler.throwNotFoundError('Order not found');
        const allowed = ORDER_STATUS_TRANSITIONS[order.Status] ?? [];
        if (!allowed.includes(nextStatus)) {
            ErrorHandler.throwConflictError(`Cannot move from ${order.Status} → ${nextStatus}`, { Allowed: allowed });
        }

        await Source.transaction(async (manager) => {
            const from = order.Status;
            order.Status = nextStatus;
            await manager.save(order);
            await manager.save(manager.create(OrderStatusHistory, {
                OrderId      : order.id,
                FromStatus   : from,
                ToStatus     : nextStatus,
                ChangedBy    : actorUserId,
                ChangedByName: actorName,
                Note         : note,
            }));
        });

        //A cancelled order must give its seats back, or the slot stays full of
        //orders that no longer exist and real customers are turned away.
        if (nextStatus === OrderStatus.Cancelled) {
            const released = await this._slots.releaseForOrder(id);
            if (released > 0) logger.info(`Order ${order.OrderCode} cancelled — released ${released} slot seat(s)`);
        }

        void this.announceStatus(order, nextStatus);
        return this.getById(tenantId, id);
    };

    /**
     * Which customer-facing message each status change earns.
     *
     * Not every transition is worth a message. `InProcess` means "it's in the
     * machine" — the customer does not need their phone to buzz for that, and
     * a business that texts about every internal step gets muted or blocked.
     * Statuses absent from this map are shown in the app's tracking timeline
     * but are not pushed.
     */
    //  OutForDelivery is deliberately absent: the delivery RUN starting fires a
    //  richer OUT_FOR_DELIVERY (with the partner's name and number) than an
    //  order-status change could, so routing it here too would double-message.
    private static readonly STATUS_TEMPLATES: Partial<Record<OrderStatus, string>> = {
        [OrderStatus.Received]  : 'PICKUP_DONE',
        [OrderStatus.Ready]     : 'ORDER_READY',
        [OrderStatus.Delivered] : 'ORDER_DELIVERED',
    };

    private announceStatus = async (order: Order, status: OrderStatus): Promise<void> => {
        //The live view gets EVERY transition — a staff board should show the
        //real state, including the steps not worth a text message.
        await OrderEvents.publish({
            Type      : 'order.status',
            TenantId  : order.TenantId,
            OrderId   : order.id,
            OrderCode : order.OrderCode,
            CustomerId: order.CustomerId,
            Status    : status,
            Title     : `${order.OrderCode} → ${status}`,
            Detail    : order.CustomerName,
            At        : new Date().toISOString(),
        });

        const code = OrderService.STATUS_TEMPLATES[status];
        if (!code || !order.CustomerPhone) return;

        //PICKUP_DONE reads "Collected {{ItemCount}} item(s)". Prefer what the
        //partner actually counted at the door over what the customer booked —
        //the two rarely match. Fall back to the booked line count.
        const itemCount = status === OrderStatus.Received
            ? await this.collectedItemCount(order.id)
            : 0;

        await this._notify.fanOut({
            TenantId : order.TenantId,
            Code     : code,
            Recipient: order.CustomerPhone,
            Variables: {
                OrderCode : order.OrderCode,
                Name      : order.CustomerName,
                //ORDER_READY's copy reads "ready for {{Mode}}".
                Mode      : order.DeliveryType === OrderDeliveryType.HomeDelivery ? 'delivery' : 'pickup from the shop',
                ItemCount : itemCount,
            },
        }, ['SMS', 'Push']);
    };

    /**
     * Where is my order?
     *
     * Projects the audit history into a journey the customer can read. The
     * step list depends on the order's own shape — a DropAtShop order never
     * shows a pickup step at all.
     */
    public tracking = async (tenantId: string, orderId: string, callerCustomerId: string | null): Promise<TrackingDto> => {
        const order = await this._orderRepo.findOne({ where: { id: orderId, TenantId: tenantId } });
        if (!order) ErrorHandler.throwNotFoundError('Order not found');
        //404 rather than 403 — a 403 would confirm the order exists and let
        //someone enumerate ids.
        if (callerCustomerId && order.CustomerId !== callerCustomerId) {
            ErrorHandler.throwNotFoundError('Order not found');
        }

        const history = await this._historyRepo.find({ where: { OrderId: orderId }, order: { CreatedAt: 'ASC' } });
        const reachedAt = new Map<string, string>();
        for (const h of history) reachedAt.set(h.ToStatus, h.CreatedAt.toISOString());

        const isCancelled = order.Status === OrderStatus.Cancelled;
        const plan  = buildSteps(order.Channel, order.DeliveryType);
        const runs  = await this._runs.listForOrder(orderId);

        //Index of the step the order is sitting on now.
        const currentIdx = plan.findIndex((s) => s.Statuses.includes(order.Status));

        const steps: TrackingStep[] = plan.map((s, i) => {
            const at = s.Statuses.map((st) => reachedAt.get(st)).find(Boolean);
            let state: TrackingStepState;
            if (isCancelled)            state = at ? 'Done' : 'Skipped';
            else if (at)                state = i === currentIdx ? 'Current' : 'Done';
            else if (i < currentIdx)    state = 'Done';      //jumped past it (admin shortcut)
            else if (i === currentIdx)  state = 'Current';
            else                        state = 'Upcoming';
            return { Key: s.Key, Label: s.Label, LabelMr: s.LabelMr, State: state, At: at };
        });

        const done = steps.filter((s) => s.State === 'Done' || s.State === 'Current').length;

        return {
            OrderId        : order.id,
            OrderCode      : order.OrderCode,
            Status         : order.Status,
            PercentComplete: isCancelled ? 0 : Math.round((done / steps.length) * 100),
            IsComplete     : order.Status === OrderStatus.Delivered || order.Status === OrderStatus.Closed,
            IsCancelled    : isCancelled,
            Steps          : steps,
            Pickup         : await this.legFor(order.PickupSlotBookingId, DeliveryDirection.Pickup, runs),
            Delivery       : await this.legFor(order.DeliverySlotBookingId, DeliveryDirection.Delivery, runs),
        };
    };

    /** Slot + partner detail for one leg, or undefined when the order has none. */
    private legFor = async (
        bookingId: string | null,
        direction: DeliveryDirection,
        runs: Array<{ Direction: string; Status: string; PartnerId: string; ItemCountCollected?: number }>,
    ): Promise<TrackingLeg | undefined> => {
        if (!bookingId) return undefined;
        const booking = await this._slots.getById(bookingId);
        if (!booking) return undefined;

        const slot = await this._slotRepo.findOne({ where: { id: booking.SlotId } });
        const run  = runs.find((r) => r.Direction === direction);

        //Only hand over the partner's name and number once they are actually
        //on the way. Before that it is someone's personal number attached to a
        //job they may not end up doing.
        const enRoute = run && ['Started', 'Arrived'].includes(run.Status);
        const partner = enRoute ? await this._partnerRepo.findOne({ where: { id: run!.PartnerId } }) : null;

        return {
            Direction   : direction === DeliveryDirection.Pickup ? 'Pickup' : 'Delivery',
            Date        : booking.BookingDate,
            SlotName    : slot?.Name,
            SlotWindow  : slot ? `${String(slot.StartTime).slice(0, 5)}–${String(slot.EndTime).slice(0, 5)}` : undefined,
            Status      : run?.Status,
            PartnerName : partner?.Name,
            PartnerPhone: partner?.Phone,
            ItemCount   : run?.ItemCountCollected,
        };
    };

    private collectedItemCount = async (orderId: string): Promise<number> => {
        const runs = await this._runs.listForOrder(orderId);
        const pickup = runs.find((r) => r.Direction === DeliveryDirection.Pickup && r.ItemCountCollected != null);
        if (pickup) return pickup.ItemCountCollected;
        //Dropped at the shop, or the partner didn't record a count.
        const lines = await this._lineRepo.find({ where: { OrderId: orderId } });
        return lines.reduce((sum, l) => sum + (l.Quantity ?? 0), 0);
    };
}
