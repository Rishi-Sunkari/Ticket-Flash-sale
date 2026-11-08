/**
 * Error taxonomy.
 *
 * Operational errors (expected, e.g. "email already taken") carry an HTTP
 * status and a stable machine-readable `code`. Everything else is treated as a
 * programmer error: it is logged with a stack trace and returned as a generic
 * 500 so internals never leak to clients.
 */
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, new.target);
  }

  static badRequest(message, details) {
    return new AppError(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(message, { statusCode: 401, code: 'UNAUTHENTICATED' });
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(message, { statusCode: 403, code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, { statusCode: 404, code: 'NOT_FOUND' });
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, { statusCode: 409, code });
  }

  static serviceUnavailable(message, code = 'SERVICE_UNAVAILABLE') {
    return new AppError(message, { statusCode: 503, code });
  }

  static notImplemented(message = 'Not implemented yet') {
    return new AppError(message, { statusCode: 501, code: 'NOT_IMPLEMENTED' });
  }
}

/**
 * Raised whenever a booking is asked to move to a status that the lifecycle
 * does not allow (e.g. CONFIRMED -> PROCESSING).
 */
export class InvalidStatusTransitionError extends AppError {
  constructor(from, to) {
    super(`Illegal booking status transition: ${from} -> ${to}`, {
      statusCode: 409,
      code: 'INVALID_STATUS_TRANSITION',
    });
    this.from = from;
    this.to = to;
  }
}
