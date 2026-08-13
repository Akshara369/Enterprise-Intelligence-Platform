import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { validate, schemas } from '../middleware/validate.js';
import { errorHandler } from '../middleware/errorHandler.js';

/**
 * Build a minimal Express app with validation on a specific schema,
 * plus the centralized errorHandler so AppErrors are serialised properly.
 */
function buildApp(schema) {
  const app = express();
  app.use(express.json());
  app.post('/test', validate(schema), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

// ─── createTransaction schema ─────────────────────────────────────

describe('validate(schemas.createTransaction)', () => {
  const app = buildApp(schemas.createTransaction);

  it('passes valid payload through', async () => {
    const res = await request(app)
      .post('/test')
      .send({ productId: 'prod_1', quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects missing productId with 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ quantity: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects non-integer quantity with 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ productId: 'prod_1', quantity: 2.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects negative quantity with 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ productId: 'prod_1', quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects empty body with 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

// ─── backtest schema ──────────────────────────────────────────────

describe('validate(schemas.backtest)', () => {
  const app = buildApp(schemas.backtest);

  it('passes valid payload', async () => {
    const res = await request(app)
      .post('/test')
      .send({ strategyName: 'smaCrossover', ticker: 'TECH' });

    expect(res.status).toBe(200);
  });

  it('rejects empty strategyName', async () => {
    const res = await request(app)
      .post('/test')
      .send({ strategyName: '', ticker: 'TECH' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});
