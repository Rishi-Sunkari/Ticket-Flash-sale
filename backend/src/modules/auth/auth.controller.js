import { asyncHandler } from '../../utils/async-handler.js';
import * as authService from './auth.service.js';

/**
 * Controllers stay thin: translate HTTP -> service call -> HTTP response.
 * Business rules (hashing, uniqueness, token issuing) live in the service so
 * they can be reused by tests, workers or future gRPC/GraphQL entry points.
 */
export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json({ data: result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  res.status(200).json({ data: result });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  res.status(200).json({ data: { user } });
});
