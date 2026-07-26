import { DependencyContainer } from 'tsyringe';
import { UserService }     from '../database/typeorm/services/user.service';
import { CustomerService } from '../database/typeorm/services/customer.service';
import { AuthService }     from '../database/typeorm/services/auth.service';
import { OtpService }      from '../database/typeorm/services/otp.service';
import { JwtService }      from '../database/typeorm/services/jwt.service';
import { TenantService }   from '../database/typeorm/services/tenant.service';
import { RoleService }     from '../database/typeorm/services/role.service';
import { NotificationsServiceConnector } from './notifications/notifications.service.connector';

/////////////////////////////////////////////////////////////////////////
//  Domain service singletons registered with the DI container. Plug
//  cross-cutting modules (email/sms/storage adapters) here as they
//  arrive.
/////////////////////////////////////////////////////////////////////////

export class ModuleInjector {

    public static registerInjections = (container: DependencyContainer): void => {
        container.registerSingleton(UserService);
        container.registerSingleton(CustomerService);
        container.registerSingleton(AuthService);
        container.registerSingleton(NotificationsServiceConnector);
        container.registerSingleton(OtpService);
        container.registerSingleton(JwtService);
        container.registerSingleton(TenantService);
        container.registerSingleton(RoleService);
    };
}
