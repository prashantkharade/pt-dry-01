import type { CurrentUser } from '../../domain.types/miscellaneous/current.user';

declare global {
    namespace Express {
        interface Request {
            currentUser? : CurrentUser;
            clientApp?   : string;
            context?     : string;
            correlationId?: string;
        }
    }
}

export {};
