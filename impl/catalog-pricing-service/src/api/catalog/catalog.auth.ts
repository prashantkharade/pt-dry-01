import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Catalog';

export class CatalogAuth {

    static readonly listServiceTypes: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListServiceTypes`,
        Ownership   : ResourceOwnership.System,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly listCategories: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListCategories`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly listItems: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListItems`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly getItem: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetItem`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
    };
}
