import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/env.js';

/** Any request that matched no route falls through here. */
export function notFoundHandler(req, _res, next) {
  next(
    new AppError(`Route ${req.method} ${req.originalUrl} does not exist`, {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
    }),
  );
}

/**
 * Central error handler — the only place that decides how an error becomes an
 * HTTP response, so status codes stay consistent across modules.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args).
export function errorHandler(error, req, res, _next) {
  const normalised = normaliseError(error);

  const logPayload = {
    err: error,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    statusCode: normalised.statusCode,
    code: normalised.code,
  };

  if (normalised.statusCode >= 500) {
    logger.error(logPayload, 'Unhandled request error');
  } else {
    logger.warn(logPayload, 'Request rejected');
  }

  if (res.headersSent) {
    return;
  }

  const body = {
    error: {
      code: normalised.code,
      message: normalised.message,
      ...(normalised.details ? { details: normalised.details } : {}),
      ...(isProduction || normalised.statusCode < 500
        ? {}
        : { stack: error?.stack }),
    },
  };

  res.status(normalised.statusCode).json(body);
}

function normaliseError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return AppError.badRequest('Request validation failed', {
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique constraint, P2025 record not found, P2003 FK violation.
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(', ')
        : String(error.meta?.target ?? 'field');

      return AppError.conflict(`A record with this ${target} already exists`, 'DUPLICATE_RECORD');
    }

    if (error.code === 'P2025') {
      return AppError.notFound('Record not found');
    }

    if (error.code === 'P2003') {
      return AppError.badRequest('Related record does not exist');
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return AppError.badRequest('Invalid database query parameters');
  }

  // express.json() surfaces malformed bodies as SyntaxError with status 400.
  if (error instanceof SyntaxError && 'body' in error) {
    return AppError.badRequest('Malformed JSON body');
  }

  return new AppError('Internal server error', {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  });
}
