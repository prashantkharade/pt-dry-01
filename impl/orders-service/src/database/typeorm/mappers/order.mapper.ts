import { Order } from '../models/order.model';
import { OrderItem } from '../models/order.item.model';
import { OrderStatusHistory } from '../models/order.status.history.model';
import {
    OrderDto, OrderHistoryDto, OrderLineDto,
} from '../../../domain.types/orders/order.types';

export class OrderLineMapper {
    static toDto = (oi: OrderItem): OrderLineDto => {
        if (!oi) return null;
        return {
            id              : oi.id,
            ItemId          : oi.ItemId,
            ItemCode        : oi.ItemCode,
            ItemName        : oi.ItemName,
            ServiceTypeCode : oi.ServiceTypeCode,
            Quantity        : oi.Quantity,
            UnitRateInr     : oi.UnitRateInr,
            LineTotalInr    : oi.LineTotalInr,
            Note            : oi.Note,
        };
    };
}

export class OrderHistoryMapper {
    static toDto = (h: OrderStatusHistory): OrderHistoryDto => {
        if (!h) return null;
        return {
            id            : h.id,
            FromStatus    : h.FromStatus,
            ToStatus      : h.ToStatus,
            ChangedBy     : h.ChangedBy,
            ChangedByName : h.ChangedByName,
            Note          : h.Note,
            CreatedAt     : h.CreatedAt,
        };
    };
}

export class OrderMapper {
    static toDto = (
        order: Order,
        lines: OrderItem[] = [],
        history: OrderStatusHistory[] = [],
    ): OrderDto => {
        if (!order) return null;
        return {
            id                : order.id,
            OrderCode         : order.OrderCode,
            TenantId          : order.TenantId,
            BranchId          : order.BranchId,
            CustomerId        : order.CustomerId,
            CustomerName      : order.CustomerName,
            CustomerPhone     : order.CustomerPhone,
            BilledTo          : order.BilledTo,
            ServiceTypeCode   : order.ServiceTypeCode,
            Channel           : order.Channel,
            DeliveryType      : order.DeliveryType,
            IsExpress         : order.IsExpress,
            Status            : order.Status,
            ScheduledAt       : order.ScheduledAt,
            DeliveryAddressId : order.DeliveryAddressId,
            SubtotalInr       : order.SubtotalInr,
            DeliveryChargeInr : order.DeliveryChargeInr,
            ExpressChargeInr  : order.ExpressChargeInr,
            GstInr            : order.GstInr,
            TotalInr          : order.TotalInr,
            Notes             : order.Notes,
            Lines             : (lines ?? []).map(OrderLineMapper.toDto),
            History           : (history ?? []).map(OrderHistoryMapper.toDto),
            CreatedAt         : order.CreatedAt,
            UpdatedAt         : order.UpdatedAt,
        };
    };
}
