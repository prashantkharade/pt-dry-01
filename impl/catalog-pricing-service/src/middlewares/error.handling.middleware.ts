import express from 'express';
import { ResponseHandler } from '../common/handlers/response.handler';
import { logger } from '../logger/logger';

export const errorHandlerMiddleware = (
    error: any,
    request: express.Request,
    response: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
): express.Response => {
    if (error?.stack) {
        logger.error(JSON.stringify({ message: error.message, stack: error.stack.split('\n') }, null, 2));
    } else {
        logger.error(JSON.stringify({ message: String(error) }));
    }
    return ResponseHandler.handleError(request, response, error);
};
