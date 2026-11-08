import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { closeBookingQueue } from './queues/booking.queue.js';
import { logger } from './utils/logger.js';

/**
 * Process entry point. Responsibilities, in order:
 *   1. open dependencies,
 *   2. start listening,
 *   3. shut down cleanly on SIGINT/SIGTERM.
 *
 * Startup policy: PostgreSQL is required (the API is useless without it), while
 * Redis outages are tolerated so the readiness probe can report them instead of
 * crash-looping the container. Requests that need the queue fail with 503.
 */
async function bootstrap() {
  await connectDatabase();

  try {
    await connectRedis();
  } catch (error) {
    logger.warn(
      { err: error.message },
      'Redis is unreachable - /api/v1/health/ready will report degraded',
    );
  }

  const server = http.createServer(createApp());

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `FlashSale API listening on http://localhost:${env.PORT}`,
    );
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown started');

    // Stop accepting new connections, then release resources.
    server.close(async () => {
      await Promise.allSettled([
        closeBookingQueue(),
        disconnectRedis(),
        disconnectDatabase(),
      ]);

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Do not hang forever if a socket refuses to close.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception - exiting');
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start the API');
  process.exit(1);
});
