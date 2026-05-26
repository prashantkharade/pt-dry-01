import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Order';

export class OrderAuth {

    static readonly create: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Create`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist', 'Customer'],
    };

    static readonly search: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Search`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly listMine: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListMine`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.Search,
    };

    static readonly getById: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetById`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
    };

    static readonly updateStatus: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.UpdateStatus`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };
}
