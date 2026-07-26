/////////////////////////////////////////////////////////////////////////
//  Auth DTOs — request bodies and login result envelope.
/////////////////////////////////////////////////////////////////////////

export interface OtpSendModel {
    Phone: string;
    Language?: 'en' | 'mr';
}

export interface OtpVerifyModel {
    Phone : string;
    Otp   : string;
}

export interface PasswordLoginModel {
    EmailOrPhone : string;
    Password     : string;
}

export interface LoginResultDto {
    AccessToken  : string;
    RefreshToken : string;
    User: {
        id               : string;
        FirstName        : string;
        LastName?        : string;
        Email?           : string;
        Phone?           : string;
        TenantId         : string;
        BranchId         : string;
        Roles            : string[];
        PreferredLanguage: string;
        ProfileImageUrl? : string;
    };
}

export interface JwtPayload {
    UserId    : string;
    TenantId  : string;
    BranchId? : string;
    SessionId : string;
    Roles     : string[];
    Type      : 'access' | 'refresh';
}
