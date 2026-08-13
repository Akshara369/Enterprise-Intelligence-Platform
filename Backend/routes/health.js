import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  const checks = {
    api: 'ok',
    storage: databaseConnected
      ? 'MongoDB (connected)'
      : 'MongoDB (disconnected)',
  };

  const ready = databaseConnected;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});