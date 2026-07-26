import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Notification';

export class NotificationAuth {

    static readonly send: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Send`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Custom,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    //  Service-to-service: orders/payments fire notifications off domain
    //  events, with no user in scope. AllowedClients is what keeps this safe —
    //  AllowAnonymous alone would let anyone holding the customer-app key send
    //  arbitrary SMS from our account.
    static readonly sendTemplate: AuthOptions = {
        ...DefaultAuthOptions,
        Context       : `${_baseContext}.SendTemplate`,
        Ownership     : ResourceOwnership.System,
        ActionScope   : ActionScope.System,
        RequestType   : RequestType.Custom,
        AllowAnonymous: true,
        AllowedClients: ['ORDERS-SERVICE', 'PAYMENTS-SERVICE', 'IDENTITY-SERVICE', 'ADMIN-PORTAL'],
    };

    static readonly readLogs: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ReadLogs`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };
}
