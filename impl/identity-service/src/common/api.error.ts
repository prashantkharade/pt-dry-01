import { HttpStatusCodes } from './http.status.codes';

/////////////////////////////////////////////////////////////////////////
//  ApiError + ErrorHandler — the canonical way to surface failures.
//  Controllers throw via ErrorHandler.throw*; the global error middleware
//  serializes the error into the standard response envelope.
/////////////////////////////////////////////////////////////////////////

export class ApiError extends Error {

    public readonly StatusCode : number;
    public readonly Details    : unknown;
    public readonly Cause      : Error | null;

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

    static throwInputValidationError = (errorMessages: string[]): never => {
        throw new InputValidationError(errorMessages);
    };

    static throwDuplicateError = (message: string, details?: unknown): never => {
        throw new ApiError(message, HttpStatusCodes.CONFLICT, details);
    };

    static throwNotFoundError = (message: string): never => {
        throw new ApiError(message, HttpStatusCodes.NOT_FOUND);
    };

    static throwUnauthorizedError = (message = 'Unauthorized'): never => {
        throw new ApiError(message, HttpStatusCodes.UNAUTHORIZED);
    };

    static throwForbiddenError = (message = 'Forbidden'): never => {
        throw new ApiError(message, HttpStatusCodes.FORBIDDEN);
    };

    static throwConflictError = (message: string, details?: unknown): never => {
        throw new ApiError(message, HttpStatusCodes.CONFLICT, details);
    };

    static throwUnprocessableError = (message: string, details?: unknown): never => {
        throw new ApiError(message, HttpStatusCodes.UNPROCESSABLE, details);
    };

    static throwInternalServerError = (message = 'Internal server error', cause: Error = null): never => {
        throw new ApiError(message, HttpStatusCodes.INTERNAL_SERVER_ERROR, undefined, cause);
    };

    static handleValidationError = (error: any): void => {
        if (error?.isJoi === true) {
            const errorMessages = (error.details ?? []).map((x: any) => x.message);
            ErrorHandler.throwInputValidationError(errorMessages);
        }
    };
}
