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

    //  The customer's own app calls this after checkout, so Customer is allowed.
    //  It is safe because verify proves the provider signed the result and then
    //  re-fetches the truth from the provider — the caller's claims are ignored.
    static readonly verify: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Verify`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist', 'Customer'],
    };

    //  Refunds move money OUT. Staff only — never the customer.
    static readonly refund: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.Refund`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    static readonly readRefunds: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ReadRefunds`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    //  --- Wallet ---
    //  Reads are open to any authenticated user: the customer app shows its own
    //  balance. WRITES are staff-only — a customer who could credit their own
    //  wallet would have free laundry.
    static readonly walletRead: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.WalletRead`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
    };

    static readonly walletWrite: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.WalletWrite`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.CreateOne,
        AllowedRoles: ['SystemAdmin', 'Receptionist'],
    };

    //  Credit limits are a commercial decision, not a counter task.
    static readonly walletAdmin: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.WalletAdmin`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.UpdateOne,
        AllowedRoles: ['SystemAdmin'],
    };
}
