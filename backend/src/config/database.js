import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Prisma client wrapper.
 *
 * A single PrismaClient per process is important: it owns the connection pool.
 * Creating a client per request is a classic way to exhaust PostgreSQL
 * connections. During development we cache it on `globalThis` so `nodemon`
 * reloads do not leak pools.
 *
 * In serverless/multi-process deployments each worker process gets its own
 * pool — PostgreSQL's `max_connections` must be sized accordingly.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__flashsalePrisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.__flashsalePrisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
  logger.info('PostgreSQL connection established');
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

/** Cheap round-trip used by readiness probes. */
export async function checkDatabase() {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}

export { env };
