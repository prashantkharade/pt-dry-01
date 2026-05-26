import express from 'express';
import { ApiError, InputValidationError } from '../api.error';
import { HttpStatusCodes } from '../http.status.codes';
import { logger } from '../../logger/logger';
import { ConfigurationManager } from '../../config/configuration.manager';

export interface ResponseDto<T = any> {
    Status      : 'success' | 'failure';
    Message     : string;
    HttpCode    : number;
    Data        : T | null;
    Errors?     : unknown;
    Client?     : string | null;
    User?       : any;
    Context?    : string | null;
    ApiVersion? : string;
    ServiceName?: string;
}

export class ResponseHandler {

    public static success(request: express.Request, response: express.Response, message: string, httpCode = HttpStatusCodes.OK, data?: any): express.Response {
        const envelope: ResponseDto = {
            Status      : 'success',
            Message     : message,
            HttpCode    : httpCode,
            Data        : data ?? null,
            Client      : (request as any).clientApp ?? null,
            User        : (request as any).currentUser ?? null,
            Context     : (request as any).context ?? null,
            ApiVersion  : ConfigurationManager._config?.ApiVersion,
            ServiceName : ConfigurationManager._config?.ServiceName,
        };
        return response.status(httpCode).json(envelope);
    }

    public static created(request: express.Request, response: express.Response, message: string, data?: any): express.Response {
        return ResponseHandler.success(request, response, message, HttpStatusCodes.CREATED, data);
    }

    public static noContent(response: express.Response): express.Response {
        return response.status(HttpStatusCodes.NO_CONTENT).send();
    }

    public static failure(request: express.Request, response: express.Response, message: string, httpCode: number, errors?: unknown): express.Response {
        const envelope: ResponseDto = {
            Status      : 'failure',
            Message     : message,
            HttpCode    : httpCode,
            Data        : null,
            Errors      : errors,
            Client      : (request as any).clientApp ?? null,
            User        : (request as any).currentUser ?? null,
            Context     : (request as any).context ?? null,
            ApiVersion  : ConfigurationManager._config?.ApiVersion,
            ServiceName : ConfigurationManager._config?.ServiceName,
        };
        if (process.env.NODE_ENV !== 'test') {
            logger.warn(JSON.stringify({ ResponseEnvelope: envelope }, null, 2));
        }
        return response.status(httpCode).json(envelope);
    }

    public static handleError(request: express.Request, response: express.Response, error: any): express.Response {
        if (error instanceof InputValidationError) {
            return ResponseHandler.failure(request, response, error.message, error.StatusCode, error.Details);
        }
        if (error instanceof ApiError) {
            return ResponseHandler.failure(request, response, error.message, error.StatusCode, error.Details);
        }
        if (error?.isJoi === true) {
            const messages = (error.details ?? []).map((x: any) => x.message);
            return ResponseHandler.failure(request, response, 'Validation failed', HttpStatusCodes.BAD_REQUEST, messages);
        }
        const message = error?.message ?? 'Internal server error';
        return ResponseHandler.failure(request, response, message, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
}
