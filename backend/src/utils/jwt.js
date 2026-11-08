import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * JWT helpers.
 *
 * Design notes:
 * - `sub` carries the user id (registered JWT claim), so clients never send an
 *   authoritative id in the request body.
 * - `role` is embedded for cheap authorisation checks. The trade-off is that a
 *   role change is only visible after the token is refreshed; for this project
 *   that is acceptable and documented rather than hidden.
 * - Only public claims go in the token. Never put password hashes or PII.
 */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, issuer: 'flashsale-api' },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { issuer: 'flashsale-api' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Access token has expired', {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
      });
    }
    throw AppError.unauthorized('Invalid access token');
  }
}
