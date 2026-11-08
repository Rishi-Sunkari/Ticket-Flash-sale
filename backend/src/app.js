import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { corsOrigins, env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import eventRoutes from './modules/events/event.routes.js';
import bookingRoutes from './modules/bookings/booking.routes.js';
import healthRoutes from './modules/health/health.routes.js';

/**
 * The Express application is built here and exported separately from the HTTP
 * server (`server.js`). That split lets integration tests exercise the app with
 * Supertest without binding a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Security headers. `crossOriginResourcePolicy` is relaxed so the Angular dev
  // server on another port can still consume JSON from this API.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS is required because the SPA and the API are separate origins
  // (Angular on :4200, API on :4000) in development.
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // A small body limit is a cheap defence against memory-exhaustion payloads.
  app.use(express.json({ limit: '100kb' }));

  // Request correlation id + access log. Binding the id to the logger means
  // every later line for this request can be traced back to it.
  app.use((req, res, next) => {
    req.id = req.get('X-Request-Id') ?? randomUUID();
    res.setHeader('X-Request-Id', req.id);

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      logger.info(
        {
          requestId: req.id,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(1)),
          userId: req.user?.id,
        },
        'request completed',
      );
    });

    next();
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      data: {
        service: 'flashsale-api',
        environment: env.NODE_ENV,
        docs: '/api/v1/health',
      },
    });
  });

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/events', eventRoutes);
  app.use('/api/v1/bookings', bookingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
