import { container, DependencyContainer } from 'tsyringe';
import { ModuleInjector } from '../modules/module.injector';

export class Injector {

    private static _container: DependencyContainer = container;

    public static get Container(): DependencyContainer {
        return Injector._container;
    }

    public static registerInjections = (): void => {
        ModuleInjector.registerInjections(Injector.Container);
    };
}
