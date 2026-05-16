export class ApiError extends Error {
  public readonly httpCode: number;
  public readonly details?: unknown;

  constructor(httpCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.httpCode = httpCode;
    this.details = details;
  }

  static badRequest(msg: string, details?: unknown) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg: string, details?: unknown) { return new ApiError(409, msg, details); }
  static unprocessable(msg: string, details?: unknown) { return new ApiError(422, msg, details); }
  static internal(msg = 'Internal server error') { return new ApiError(500, msg); }
}
