import { z } from 'zod';

/**
 * Schema-driven request validation.
 *
 * Zod strips unknown keys by default (`z.object` is non-passthrough), which is
 * also a small security win: clients cannot inject extra fields that might
 * later be spread into a database write.
 */
export function validate({ body, params, query } = {}) {
  return function validateRequest(req, _res, next) {
    try {
      if (body) {
        req.body = body.parse(req.body ?? {});
      }

      if (params) {
        req.params = params.parse(req.params);
      }

      if (query) {
        // Express 5 makes req.query a read-only getter, so parsed query values
        // are exposed separately instead of being reassigned.
        req.validatedQuery = query.parse(req.query ?? {});
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const uuidSchema = z.string().uuid('Must be a valid UUID');
