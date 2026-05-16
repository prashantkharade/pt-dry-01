import { DataSource } from 'typeorm';
import { ConfigurationManager } from '@ptk/shared';
import { ServiceType } from './models/service-type.entity';
import { ItemCategory } from './models/item-category.entity';
import { Item } from './models/item.entity';
import { RateCard } from './models/rate-card.entity';
import { SurchargeConfig } from './models/surcharge-config.entity';
import { Order } from './models/order.entity';
import { OrderItem } from './models/order-item.entity';
import { OrderStatusHistory } from './models/order-status-history.entity';

export const dataSource = new DataSource({
  type: 'postgres',
  url: ConfigurationManager.get('ORDERS_DB_URL'),
  entities: [ServiceType, ItemCategory, Item, RateCard, SurchargeConfig, Order, OrderItem, OrderStatusHistory],
  synchronize: true,
  logging: process.env.LOG_SQL === '1',
});
