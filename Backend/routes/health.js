import { Router } from 'express';

export const healthRouter = Router();
const startTime = Date.now();

// Liveness: "is the process up at all". Used by orchestrators (Docker/K8s) to
// decide whether to restart the container.
healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Readiness: "is the app ready to serve real traffic" - i.e. dependencies are up.
// Right now storage is in-memory so it's always ready; once a real DB is added,
// this should ping the DB connection and flip to 503 if it's unreachable.
healthRouter.get('/ready', async (req, res) => {
  const checks = {
    storage: 'in-memory (ok)',
    // dbConnection: await checkDb(),  <-- teammate wires this in once DB lands
  };
  res.json({ status: 'ready', checks, timestamp: new Date().toISOString() });
});
