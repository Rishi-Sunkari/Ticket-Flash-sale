import pino from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logging.
 *
 * Why a real logger instead of console.log?
 * - JSON logs are machine-parseable (grep/jq, Loki, CloudWatch, Datadog).
 * - Levels let us silence noise in tests and raise verbosity when debugging.
 * - Request-scoped fields (requestId, userId) can be bound once and inherited.
 *
 * `pino-pretty` is only used in development so production keeps the raw JSON
 * pipeline that log collectors expect.
 */
const usePrettyTransport = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'flashsale-api' },
  ...(usePrettyTransport
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

/** Child logger for a long-running process (API vs worker vs expiration). */
export function createLogger(name, extra = {}) {
  return logger.child({ component: name, ...extra });
}
