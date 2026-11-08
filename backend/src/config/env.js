import 'dotenv/config';
import { z } from 'zod';

/**
 * Single source of truth for configuration.
 *
 * Why validate and exit at boot? A misconfigured process should fail loudly
 * once, with a readable message, instead of throwing a confusing error on the
 * first request (or silently running with a weak JWT secret in production).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().min(1).default('1h'),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:4200'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  RESERVATION_TTL_SECONDS: z.coerce.number().int().min(30).default(600),
  EXPIRATION_SWEEP_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Parsed list of allowed browser origins. */
export const corsOrigins = Object.freeze(
  env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
