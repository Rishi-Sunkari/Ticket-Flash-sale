import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

/**
 * HTTP-level smoke tests. They intentionally avoid PostgreSQL and Redis:
 * validation and routing failures happen before any dependency is touched, so
 * these run anywhere (CI included) with no infrastructure.
 */
const app = createApp();

describe('health endpoints', () => {
  it('GET /api/v1/health/live reports the process is alive', async () => {
    const response = await request(app).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('alive');
    expect(typeof response.body.data.uptimeSeconds).toBe('number');
  });

  it('GET /api/v1/health returns service metadata', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.data.service).toBe('flashsale-api');
  });
});

describe('routing and validation', () => {
  it('returns a stable error code for unknown routes', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects an invalid registration payload before hitting the database', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      name: 'A',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.issues.length).toBeGreaterThan(0);
  });

  it('requires authentication for booking endpoints', async () => {
    const response = await request(app).get('/api/v1/bookings');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
