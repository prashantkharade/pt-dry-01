import { HttpStatusCodes } from './http.status.codes';

export class ApiError extends Error {
    public readonly StatusCode: number;
    public readonly Details   : unknown;
    public readonly Cause     : Error | null;

    constructor(message: string, statusCode: number, details?: unknown, cause: Error = null) {
        super(message);
        this.name       = 'ApiError';
        this.StatusCode = statusCode;
        this.Details    = details;
        this.Cause      = cause;
    }
}

export class InputValidationError extends ApiError {
    constructor(messages: string[]) {
        super(messages.join('; '), HttpStatusCodes.BAD_REQUEST, { Errors: messages });
        this.name = 'InputValidationError';
    }
}

export class ErrorHandler {
    static throwInputValidationError = (m: string[]): never => { throw new InputValidationError(m); };
    static throwDuplicateError       = (m: string, d?: unknown): never => { throw new ApiError(m, HttpStatusCodes.CONFLICT, d); };
    static throwNotFoundError        = (m: string): never => { throw new ApiError(m, HttpStatusCodes.NOT_FOUND); };
    static throwUnauthorizedError    = (m = 'Unauthorized'): never => { throw new ApiError(m, HttpStatusCodes.UNAUTHORIZED); };
    static throwForbiddenError       = (m = 'Forbidden'): never => { throw new ApiError(m, HttpStatusCodes.FORBIDDEN); };
    static throwConflictError        = (m: string, d?: unknown): never => { throw new ApiError(m, HttpStatusCodes.CONFLICT, d); };
    static throwUnprocessableError   = (m: string, d?: unknown): never => { throw new ApiError(m, HttpStatusCodes.UNPROCESSABLE, d); };
    static throwInternalServerError  = (m = 'Internal server error', c: Error = null): never => { throw new ApiError(m, HttpStatusCodes.INTERNAL_SERVER_ERROR, undefined, c); };

    static handleValidationError = (error: any): void => {
        if (error?.isJoi === true) {
            const messages = (error.details ?? []).map((x: any) => x.message);
            ErrorHandler.throwInputValidationError(messages);
        }
    };
}
