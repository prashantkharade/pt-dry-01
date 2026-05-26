import { DependencyContainer } from 'tsyringe';
import { OrderService } from '../database/typeorm/services/order.service';
import { IdentityServiceConnector } from './identity/identity.service.connector';
import { CatalogPricingServiceConnector } from './catalog.pricing/catalog.pricing.service.connector';

export class ModuleInjector {

    public static registerInjections = (container: DependencyContainer): void => {
        container.registerSingleton(IdentityServiceConnector);
        container.registerSingleton(CatalogPricingServiceConnector);
        container.registerSingleton(OrderService);
    };
}
