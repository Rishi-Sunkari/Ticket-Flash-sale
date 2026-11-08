import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Deterministic configuration for tests: no .env file is required.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/flashsale_test?schema=public',
      JWT_SECRET: 'test-only-secret-that-is-long-enough-123456',
    },
    hookTimeout: 20_000,
  },
});
