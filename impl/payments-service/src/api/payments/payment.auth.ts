import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Payment';

export class PaymentAuth {

    static readonly initiate: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Initiate`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist', 'Customer'],
    };

    static readonly listForOrder: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListForOrder`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };

    static readonly markCash: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.MarkCash`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };
}
