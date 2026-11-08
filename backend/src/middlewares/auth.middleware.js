import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the caller
 * to `req.user`.
 *
 * Stateless by design (no session store), which is what allows the API to be
 * scaled horizontally behind a load balancer. The cost is that revocation
 * requires short-lived tokens or a denylist — a future extension point.
 */
export function authenticate(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing Bearer token'));
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Role based access control. Always compose it *after* `authenticate`.
 */
export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }

    return next();
  };
}
