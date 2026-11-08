/**
 * Express 4 does not forward rejected promises to the error middleware.
 * Wrapping every async controller keeps error handling in one place instead of
 * scattering try/catch blocks (and forgetting one).
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
