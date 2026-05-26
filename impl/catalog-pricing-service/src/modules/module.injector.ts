import { DependencyContainer } from 'tsyringe';
import { CatalogService }  from '../database/typeorm/services/catalog.service';
import { RateCardService } from '../database/typeorm/services/rate.card.service';
import { PricingService }  from '../database/typeorm/services/pricing.service';

export class ModuleInjector {
    public static registerInjections = (container: DependencyContainer): void => {
        container.registerSingleton(CatalogService);
        container.registerSingleton(RateCardService);
        container.registerSingleton(PricingService);
    };
}
