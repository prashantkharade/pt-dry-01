import type { Request, Response } from 'express';
import { LoggerContext } from './logger';

export interface ResponseEnvelope<T> {
  Status: 'success' | 'failure';
  Message: string;
  HttpCode: number;
  Data?: T;
  Trace?: string;
  Context?: string;
  Errors?: unknown;
}

export const ResponseHandler = {
  success<T>(res: Response, data: T, message = 'OK', httpCode = 200) {
    const envelope: ResponseEnvelope<T> = {
      Status: 'success',
      Message: message,
      HttpCode: httpCode,
      Data: data,
      Trace: LoggerContext.get().correlationId,
    };
    return res.status(httpCode).json(envelope);
  },

  failure(res: Response, message: string, httpCode = 400, errors?: unknown) {
    const envelope: ResponseEnvelope<null> = {
      Status: 'failure',
      Message: message,
      HttpCode: httpCode,
      Trace: LoggerContext.get().correlationId,
      Errors: errors,
    };
    return res.status(httpCode).json(envelope);
  },

  ok<T>(res: Response, data: T) { return ResponseHandler.success(res, data); },
  created<T>(res: Response, data: T, message = 'Created') { return ResponseHandler.success(res, data, message, 201); },
  noContent(res: Response) { return res.status(204).send(); },
};

export type AnyReq = Request;
