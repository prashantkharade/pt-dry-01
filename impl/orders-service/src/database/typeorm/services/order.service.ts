import { injectable, inject } from 'tsyringe';
import { Source } from '../typeorm.database.connector';
import { Order } from '../models/order.model';
import { OrderItem } from '../models/order.item.model';
import { OrderStatusHistory } from '../models/order.status.history.model';
import { BaseService } from './base.service';
import { OrderMapper } from '../mappers/order.mapper';
import {
    OrderCreateModel, OrderDto, OrderSearchFilters,
} from '../../../domain.types/orders/order.types';
import {
    OrderStatus, BilledTo, OrderDeliveryType, OrderChannel, ORDER_STATUS_TRANSITIONS,
} from '../../../domain.types/enums/order.enums';
import { BaseSearchResults } from '../../../domain.types/miscellaneous/search.types';
import { ErrorHandler } from '../../../common/api.error';
import { StringUtils } from '../../../common/utilities/string.utils';
import { IdentityServiceConnector } from '../../../modules/identity/identity.service.connector';
import { CatalogPricingServiceConnector } from '../../../modules/catalog.pricing/catalog.pricing.service.connector';

/////////////////////////////////////////////////////////////////////////
//  Application service for Order. Composes pricing (via catalog-pricing)
//  and customer lookup (via identity-service), persists the aggregate,
//  and enforces the status-transition state machine.
/////////////////////////////////////////////////////////////////////////

@injectable()
export class OrderService extends BaseService {

    constructor(
        @inject(IdentityServiceConnector)        private _identity: IdentityServiceConnector,
        @inject(CatalogPricingServiceConnector)  private _pricing:  CatalogPricingServiceConnector,
    ) {
        super();
    }

    private _orderRepo   = Source.getRepository(Order);
    private _lineRepo    = Source.getRepository(OrderItem);
    private _historyRepo = Source.getRepository(OrderStatusHistory);

    public create = async (
        input        : OrderCreateModel,
        currentUserId: string,
        accessToken  : string,
    ): Promise<OrderDto> => {
        const customer = await this._identity.getCustomer(input.CustomerId, accessToken);
        const isVendor = customer.CustomerType === 'Vendor';

        const quote = await this._pricing.quote({
            TenantId        : customer.TenantId,
            ServiceTypeCode : input.ServiceTypeCode,
            IsVendor        : isVendor,
            IsExpress       : !!input.IsExpress,
            DeliveryType    : input.DeliveryType,
            Items           : input.Items.map((i) => ({ ItemId: i.ItemId, Quantity: i.Quantity })),
        }, accessToken);

        const saved = await Source.transaction(async (manager) => {
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

            await manager.save(manager.create(OrderStatusHistory, {
                OrderId   : persisted.id,
                FromStatus: null,
                ToStatus  : OrderStatus.Booked,
                ChangedBy : currentUserId,
                Note      : 'Order created',
            }));
            return persisted;
        });

        return this.getById(saved.TenantId, saved.id);
    };

    public getById = async (tenantId: string, id: string): Promise<OrderDto> => {
        const order = await this._orderRepo.findOne({ where: { id, TenantId: tenantId } });
        if (!order) return null;
        const lines   = await this._lineRepo.find({ where: { OrderId: id } });
        const history = await this._historyRepo.find({ where: { OrderId: id }, order: { CreatedAt: 'ASC' } });
        return OrderMapper.toDto(order, lines, history);
    };

    public list = async (filters: OrderSearchFilters): Promise<BaseSearchResults<OrderDto>> => {
        const qb = this._orderRepo
            .createQueryBuilder('o')
            .where('o."TenantId" = :t', { t: filters.TenantId })
            .andWhere('o."DeletedAt" IS NULL');
        if (filters.Status)     qb.andWhere('o."Status" = :s', { s: filters.Status });
        if (filters.CustomerId) qb.andWhere('o."CustomerId" = :c', { c: filters.CustomerId });
        if (filters.Query) {
            qb.andWhere(`(o."OrderCode" ILIKE :q OR o."CustomerName" ILIKE :q OR o."CustomerPhone" ILIKE :q)`, {
                q: `%${filters.Query}%`,
            });
        }
        const pageIndex = this.pageIndex(filters.PageIndex);
        const pageSize  = this.pageSize(filters.ItemsPerPage);

        qb.orderBy('o."CreatedAt"', 'DESC').skip(pageIndex * pageSize).take(pageSize);
        const [items, total] = await qb.getManyAndCount();
        const dtos = items.map((o) => OrderMapper.toDto(o));
        return { Items: dtos, Total: total, PageIndex: pageIndex, ItemsPerPage: pageSize };
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
        return this.getById(tenantId, id);
    };
}
