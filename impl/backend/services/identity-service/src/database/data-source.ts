import { DataSource } from 'typeorm';
import { ConfigurationManager } from '@ptk/shared';
import { Tenant } from './models/tenant.entity';
import { Branch } from './models/branch.entity';
import { User } from './models/user.entity';
import { Role } from './models/role.entity';
import { UserRole } from './models/user-role.entity';
import { Customer } from './models/customer.entity';
import { CustomerAddress } from './models/customer-address.entity';
import { ClientApp } from './models/client-app.entity';

export const dataSource = new DataSource({
  type: 'postgres',
  url: ConfigurationManager.get('IDENTITY_DB_URL'),
  entities: [Tenant, Branch, User, Role, UserRole, Customer, CustomerAddress, ClientApp],
  synchronize: true, // dev only — production should use migrations
  logging: process.env.LOG_SQL === '1',
});
