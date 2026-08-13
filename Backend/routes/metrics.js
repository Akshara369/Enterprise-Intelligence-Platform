import { Router } from 'express';
import client from 'prom-client';

// Collect default Node.js metrics (event loop lag, heap, GC, etc.)
client.collectDefaultMetrics();

// ── Custom metrics ────────────────────────────────────────────────

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP requests that resulted in an error (status >= 400)',
  labelNames: ['method', 'route', 'status_code'],
});

// ── Middleware ─────────────────────────────────────────────────────
// Must be mounted early so it wraps the full request lifecycle.
export const metricsCollector = (req, res, next) => {
  // Skip the /metrics endpoint itself to avoid self-referential noise
  if (req.path === '/metrics') return next();

  const end = httpRequestDuration.startTimer();

  // Patch res.end to capture final status code and timing
  const originalEnd = res.end;
  res.end = function (...args) {
    const route = req.route?.path || req.path || 'unknown';
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    end(labels);

    if (res.statusCode >= 400) {
      httpRequestErrors.inc(labels);
    }

    originalEnd.apply(this, args);
  };

  next();
};

// ── Route ─────────────────────────────────────────────────────────
export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
