import type { CurrentUser } from '../../domain.types/miscellaneous/current.user';

declare global {
    namespace Express {
        interface Request {
            currentUser? : CurrentUser;
            clientApp?   : string;
            context?     : string;
            correlationId?: string;
            //Raw request bytes, populated only for webhook routes so provider
            //HMAC signatures can be verified against what was actually sent.
            rawBody?     : Buffer;
        }
    }
}

export {};
