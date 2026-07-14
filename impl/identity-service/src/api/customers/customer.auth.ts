import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Customer';

export class CustomerAuth {

    static readonly create: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Create`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly search: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Search`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly getMine: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetMine`,
        Ownership   : ResourceOwnership.Owner,
        ActionScope : ActionScope.Owner,
        RequestType : RequestType.GetOne,
        //  Any authenticated user (typically the Customer role from the app)
        //  may read their own profile — no AllowedRoles restriction.
    };

    static readonly getById: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetById`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly update: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Update`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly getInternal: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetInternal`,
        Ownership   : ResourceOwnership.System,
        ActionScope : ActionScope.System,
        RequestType : RequestType.GetOne,
    };
}
