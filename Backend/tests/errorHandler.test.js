import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AppError, asyncHandler, errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

/**
 * Build a minimal Express app that mirrors the production error-handling stack.
 * We add a test route (or routes) and then register notFoundHandler + errorHandler
 * at the tail—exactly like server.js does.
 */
function buildApp(routeSetup) {
  const app = express();
  app.use(express.json());
  routeSetup(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// ─── AppError class ───────────────────────────────────────────────

describe('AppError', () => {
  it('produces the expected properties', () => {
    const err = new AppError('bad input', 422, 'VALIDATION_ERROR');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('bad input');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.isOperational).toBe(true);
  });

  it('defaults to 500 / INTERNAL_ERROR when optional args are omitted', () => {
    const err = new AppError('boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

// ─── errorHandler middleware ──────────────────────────────────────

describe('errorHandler middleware', () => {
  it('returns the correct status and shape for a thrown AppError', async () => {
    const app = buildApp((a) => {
      a.get('/fail', (_req, _res, next) => {
        next(new AppError('Not allowed', 403, 'FORBIDDEN'));
      });
    });

    const res = await request(app).get('/fail');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(res.body.message).toBe('Not allowed');
  });

  it('returns 500 + generic message for non-operational errors', async () => {
    const app = buildApp((a) => {
      a.get('/crash', (_req, _res, next) => {
        next(new Error('db connection pooling exploded'));
      });
    });

    const res = await request(app).get('/crash');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
    // Should NOT leak the internal message to the client
    expect(res.body.message).toBe('Something went wrong. Please try again.');
  });
});

// ─── asyncHandler ─────────────────────────────────────────────────

describe('asyncHandler', () => {
  it('catches rejected promises and forwards them to errorHandler', async () => {
    const app = buildApp((a) => {
      a.get(
        '/async-fail',
        asyncHandler(async () => {
          throw new AppError('async boom', 502, 'BAD_GATEWAY');
        }),
      );
    });

    const res = await request(app).get('/async-fail');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('BAD_GATEWAY');
    expect(res.body.message).toBe('async boom');
  });
});

// ─── notFoundHandler ──────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('returns 404 for unknown routes', async () => {
    const app = buildApp(() => {}); // no routes registered

    const res = await request(app).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toContain('/does-not-exist');
  });
});
