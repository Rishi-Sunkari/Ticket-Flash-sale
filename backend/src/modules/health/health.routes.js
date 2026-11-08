import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { checkDependencies } from './health.service.js';

const router = Router();

const startedAt = Date.now();

/**
 * Liveness probe — answers without touching any dependency.
 * Used by orchestrators to decide whether to *restart* the process.
 */
router.get('/live', (_req, res) => {
  res.status(200).json({
    data: {
      status: 'alive',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Readiness probe — checks PostgreSQL, Redis and the booking queue.
 * Used by load balancers to decide whether to *send traffic* to this instance.
 */
router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const result = await checkDependencies();

    res.status(result.isReady ? 200 : 503).json({ data: result });
  }),
);

/** Human-friendly summary for the browser / smoke tests. */
router.get('/', (_req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      service: 'flashsale-api',
      version: process.env.npm_package_version ?? '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
