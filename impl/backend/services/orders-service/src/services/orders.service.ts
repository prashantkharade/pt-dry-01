import { dataSource } from '../database/data-source';
import { Order, type OrderStatus } from '../database/models/order.entity';
import { OrderItem } from '../database/models/order-item.entity';
import { OrderStatusHistory } from '../database/models/order-status-history.entity';
import { ApiError } from '@ptk/shared';
import { PricingService } from './pricing.service';
import { IdentityClient } from './identity-client';

export interface CreateOrderInput {
  customerId: string;
  serviceTypeCode: string;
  channel: 'HomePickup' | 'DropAtShop';
  deliveryType: 'HomeDelivery' | 'CustomerPickup';
  isExpress?: boolean;
  billedTo?: 'Customer' | 'Vendor';
  items: { itemId: string; quantity: number; note?: string }[];
  scheduledAt?: string;
  deliveryAddressId?: string;
  notes?: string;
}

export interface ListFilters {
  status?: OrderStatus;
  customerId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

const STATUS_NEXT: Record<OrderStatus, OrderStatus[]> = {
  Booked: ['PickedUp', 'Received', 'Cancelled', 'OnHold'],
  PickedUp: ['Received', 'InProcess', 'Cancelled', 'OnHold'],
  Received: ['InProcess', 'Cancelled', 'OnHold'],
  InProcess: ['Ready', 'OnHold'],
  Ready: ['OutForDelivery', 'Delivered', 'OnHold'],
  OutForDelivery: ['Delivered'],
  Delivered: ['Closed'],
  Closed: [],
  Cancelled: [],
  OnHold: ['InProcess', 'Cancelled'],
};

function orderCode(tenantPrefix = 'PTK') {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${tenantPrefix}-${ymd}-${rand}`;
}

export const OrdersService = {
  async create(input: CreateOrderInput, currentUserId: string, currentUserAccessToken: string): Promise<Order> {
    const customer = await IdentityClient.getCustomer(input.customerId, currentUserAccessToken);
    const isVendor = customer.CustomerType === 'Vendor';

    const quote = await PricingService.quote({
      tenantId: customer.TenantId,
      serviceTypeCode: input.serviceTypeCode,
      isVendor,
      isExpress: !!input.isExpress,
      deliveryType: input.deliveryType,
      items: input.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
    });

    return dataSource.transaction(async (manager) => {
      const order = manager.create(Order, {
        TenantId: customer.TenantId,
        BranchId: customer.BranchId,
        OrderCode: orderCode(),
        CustomerId: customer.id,
        CustomerName: customer.Name,
        CustomerPhone: customer.Phone ?? '',
        BilledTo: input.billedTo ?? (isVendor ? 'Vendor' : 'Customer'),
        ServiceTypeCode: input.serviceTypeCode,
        Channel: input.channel,
        DeliveryType: input.deliveryType,
        IsExpress: !!input.isExpress,
        Status: 'Booked',
        ScheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        DeliveryAddressId: input.deliveryAddressId,
        SubtotalInr: String(quote.subtotalInr),
        DeliveryChargeInr: String(quote.deliveryChargeInr),
        ExpressChargeInr: String(quote.expressChargeInr),
        GstInr: String(quote.gstInr),
        TotalInr: String(quote.totalInr),
        Notes: input.notes,
        CreatedBy: currentUserId,
      });
      const saved = await manager.save(order);

      const lineRecords = quote.lines.map((line, idx) =>
        manager.create(OrderItem, {
          OrderId: saved.id,
          ItemId: line.itemId,
          ItemCode: line.itemCode,
          ItemName: line.itemName,
          ServiceTypeCode: input.serviceTypeCode,
          Quantity: line.quantity,
          UnitRateInr: String(line.unitRateInr),
          LineTotalInr: String(line.lineTotalInr),
          Note: input.items[idx]?.note,
        }),
      );
      await manager.save(lineRecords);

      await manager.save(
        manager.create(OrderStatusHistory, {
          OrderId: saved.id,
          FromStatus: undefined,
          ToStatus: 'Booked',
          ChangedBy: currentUserId,
          Note: 'Order created',
        }),
      );

      return saved;
    });
  },

  async list(tenantId: string, filters: ListFilters) {
    const repo = dataSource.getRepository(Order);
    const qb = repo
      .createQueryBuilder('o')
      .where('o."TenantId" = :t', { t: tenantId })
      .andWhere('o."DeletedAt" IS NULL');
    if (filters.status) qb.andWhere('o."Status" = :s', { s: filters.status });
    if (filters.customerId) qb.andWhere('o."CustomerId" = :c', { c: filters.customerId });
    if (filters.q) {
      qb.andWhere(`(o."OrderCode" ILIKE :q OR o."CustomerName" ILIKE :q OR o."CustomerPhone" ILIKE :q)`, {
        q: `%${filters.q}%`,
      });
    }
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
    qb.orderBy('o."CreatedAt"', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, page, pageSize, total };
  },

  async detail(tenantId: string, id: string) {
    const order = await dataSource.getRepository(Order).findOne({ where: { id, TenantId: tenantId } });
    if (!order) throw ApiError.notFound('Order not found');
    const lines = await dataSource.getRepository(OrderItem).find({ where: { OrderId: id } });
    const history = await dataSource
      .getRepository(OrderStatusHistory)
      .find({ where: { OrderId: id }, order: { CreatedAt: 'ASC' } });
    return { order, lines, history };
  },

  async updateStatus(
    tenantId: string,
    id: string,
    nextStatus: OrderStatus,
    actorUserId: string,
    actorName: string,
    note?: string,
  ) {
    const order = await dataSource.getRepository(Order).findOne({ where: { id, TenantId: tenantId } });
    if (!order) throw ApiError.notFound('Order not found');
    const allowed = STATUS_NEXT[order.Status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw ApiError.conflict(`Cannot move from ${order.Status} → ${nextStatus}`, { allowed });
    }
    return dataSource.transaction(async (manager) => {
      const from = order.Status;
      order.Status = nextStatus;
      await manager.save(order);
      await manager.save(
        manager.create(OrderStatusHistory, {
          OrderId: order.id,
          FromStatus: from,
          ToStatus: nextStatus,
          ChangedBy: actorUserId,
          ChangedByName: actorName,
          Note: note,
        }),
      );
      return order;
    });
  },
};
