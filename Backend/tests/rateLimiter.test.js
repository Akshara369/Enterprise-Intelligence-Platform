import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

/**
 * Create a fresh Express app with a very strict rate limiter for testing.
 * We use a tiny window and max so the test runs instantly.
 */
function buildApp({ max = 3, windowMs = 60_000 } = {}) {
  const app = express();

  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
  });

  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiter', () => {
  it('allows requests up to the configured max', async () => {
    const app = buildApp({ max: 3 });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 after exceeding the configured max', async () => {
    const app = buildApp({ max: 3 });

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await request(app).get('/test');
    }

    // 4th request should be rate-limited
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('RATE_LIMITED');
    expect(res.body.message).toContain('Too many requests');
  });

  it('includes standard RateLimit-* headers', async () => {
    const app = buildApp({ max: 5 });

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    // express-rate-limit v7+ uses these header names
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
    expect(res.headers).toHaveProperty('ratelimit-reset');
  });
});
