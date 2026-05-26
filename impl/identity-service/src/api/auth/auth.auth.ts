import {
    AuthOptions, ActionScope, ResourceOwnership, RequestType, DefaultAuthOptions,
} from '../../domain.types/enums/auth.enums';

/////////////////////////////////////////////////////////////////////////
//  AuthOptions for every Auth route. AllowAnonymous is true for the
//  login + OTP endpoints because the caller doesn't yet have a token.
/////////////////////////////////////////////////////////////////////////

const _baseContext = 'Auth';

export class AuthAuth {

    static readonly otpSend: AuthOptions = {
        ...DefaultAuthOptions,
        Context        : `${_baseContext}.OtpSend`,
        Ownership      : ResourceOwnership.System,
        ActionScope    : ActionScope.Public,
        RequestType    : RequestType.Custom,
        AllowAnonymous : true,
    };

    static readonly otpVerify: AuthOptions = {
        ...DefaultAuthOptions,
        Context        : `${_baseContext}.OtpVerify`,
        Ownership      : ResourceOwnership.System,
        ActionScope    : ActionScope.Public,
        RequestType    : RequestType.Custom,
        AllowAnonymous : true,
    };

    static readonly passwordLogin: AuthOptions = {
        ...DefaultAuthOptions,
        Context        : `${_baseContext}.PasswordLogin`,
        Ownership      : ResourceOwnership.System,
        ActionScope    : ActionScope.Public,
        RequestType    : RequestType.Custom,
        AllowAnonymous : true,
    };

    static readonly logout: AuthOptions = {
        ...DefaultAuthOptions,
        Context        : `${_baseContext}.Logout`,
        Ownership      : ResourceOwnership.Owner,
        ActionScope    : ActionScope.Owner,
        RequestType    : RequestType.Custom,
    };
}
