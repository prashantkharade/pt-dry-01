import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

const _baseContext = 'Tenant';

export class TenantAuth {

    static readonly getCurrent: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.GetCurrent`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.GetOne,
    };

    static readonly listBranches: AuthOptions = {
        ...DefaultAuthOptions,
        Context     : `${_baseContext}.ListBranches`,
        Ownership   : ResourceOwnership.Tenant,
        ActionScope : ActionScope.Tenant,
        RequestType : RequestType.Search,
    };
}
