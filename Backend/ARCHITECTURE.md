# Enterprise Intelligence Platform — Backend Architecture

> Last updated: August 2026

## Table of Contents

- [Request Lifecycle](#request-lifecycle)
- [Environment Variables](#environment-variables)
- [Graceful Shutdown](#graceful-shutdown)
- [Observability](#observability)
- [Integration Points for Teammates](#integration-points-for-teammates)
- [Directory Structure](#directory-structure)

---

## Request Lifecycle

Every HTTP request flows through the middleware stack in this exact order.
Middleware is registered in [`server.js`](server.js) and runs top-to-bottom.

```
Client Request
      │
      ▼
┌──────────────────────────────┐
│  1. CORS                     │  Adds Access-Control-* headers
├──────────────────────────────┤
│  2. express.json()           │  Parses JSON body
├──────────────────────────────┤
│  3. pino-http (httpLogger)   │  Assigns req.id (UUID), req.log; logs req/res
├──────────────────────────────┤
│  4. metricsCollector         │  Wraps res.end to capture duration/status
├──────────────────────────────┤
│  5. healthRouter             │  /health, /ready — no auth, no rate limit
├──────────────────────────────┤
│  6. metricsRouter            │  /metrics — Prometheus scrape endpoint
├──────────────────────────────┤
│  7. ── AUTH MIDDLEWARE ──     │  ⬅ Slot reserved for auth teammate
├──────────────────────────────┤
│  8. generalLimiter (/api/*)  │  Rate limit: RATE_LIMIT_MAX req/window/IP
├──────────────────────────────┤
│  9. Route-level validation   │  validate(schema) checks req.body via Zod
├──────────────────────────────┤
│ 10. Route handler            │  Business logic (catalog, transactions, etc.)
├──────────────────────────────┤
│ 11. notFoundHandler (404)    │  Catches unmatched routes
├──────────────────────────────┤
│ 12. errorHandler (central)   │  Serialises errors to JSON; logs via req.log
└──────────────────────────────┘
      │
      ▼
   Response
```

### Key behaviours

- **`httpLogger`** attaches a unique `req.id` (from `X-Request-Id` header if
  present, otherwise a fresh UUID). The same id is echoed back on the response
  as `X-Request-Id` and included in log entries and error payloads so every
  log line for a given request can be correlated.
- **`metricsCollector`** monkey-patches `res.end` to record timing and status
  in three Prometheus metrics (`http_requests_total`, `http_request_duration_seconds`,
  `http_request_errors_total`), all labelled by `method`, `route`, and `status_code`.
- **`validate(schema)`** is applied per-route (not globally). If validation fails,
  it creates an `AppError(message, 400, 'VALIDATION_ERROR')` and calls `next(err)`.
- **`errorHandler`** distinguishes *operational* errors (`AppError.isOperational === true`)
  from unexpected crashes. Operational errors expose their message to the client;
  unexpected errors return a generic `"Something went wrong"` message and log the
  full stack at `error` level.

---

## Environment Variables

All env vars are read in [`config/env.js`](config/env.js) and exported as a
typed `config` object. **Never read `process.env` directly elsewhere** — add new
vars to `config/env.js` and to [`.env.example`](.env.example).

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `production` — controls log format (pretty vs JSON), error stack visibility |
| `PORT` | `5001` | HTTP listen port |
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s) |
| `LOG_LEVEL` | `info` | Pino log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit sliding window in milliseconds |
| `RATE_LIMIT_MAX` | `100` | Max requests per IP per window (general limiter) |
| `DATABASE_URL` | *(none)* | 🔜 DB teammate — connection string for persistent storage |
| `JWT_SECRET` | *(none)* | 🔜 Auth teammate — secret for signing JWTs |

---

## Graceful Shutdown

Registered at the bottom of [`server.js`](server.js):

```js
const shutdown = (signal) => {
  logger.info(`${signal} received: shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // force-exit safety net
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

### How it works

1. On `SIGTERM` (Docker stop, `kill`, K8s pod eviction) or `SIGINT` (Ctrl-C),
   the handler calls `server.close()`.
2. `server.close()` stops accepting **new** connections but lets in-flight
   requests finish.
3. Once all in-flight requests complete, the `'close'` callback fires and the
   process exits cleanly with code 0.
4. A **10-second safety timeout** (`.unref()` so it doesn't keep the event loop
   alive on its own) force-exits with code 1 if connections hang — preventing
   zombie containers.

### Docker implications

- The `Dockerfile` already has a `HEALTHCHECK` against `/health`, so Docker
  knows the container is alive.
- During rolling deploys, the orchestrator sends `SIGTERM`. The 10 s grace
  period matches the default Docker `stop_timeout` (10 s), giving in-flight
  requests time to drain.

### Process safety nets

`registerProcessSafetyNets(logger)` (in [`middleware/errorHandler.js`](middleware/errorHandler.js))
registers handlers for `uncaughtException` and `unhandledRejection`. Both log
the error at `fatal` level and exit immediately — it's not safe to continue
after an uncaught exception because internal state may be corrupted.

---

## Observability

### Logging (Pino)

- **Development**: pretty-printed, colorised logs (via `pino-pretty`).
- **Production** (`NODE_ENV=production`): structured JSON — ready for log
  aggregators (ELK, Datadog, CloudWatch).
- Every log line includes the `req.id` for traceability.

### Metrics (Prometheus)

`GET /metrics` exposes Prometheus-formatted metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total request count |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request latency distribution |
| `http_request_errors_total` | Counter | `method`, `route`, `status_code` | Requests with status ≥ 400 |

Default Node.js runtime metrics (event loop lag, heap, GC) are also collected
via `prom-client`'s `collectDefaultMetrics()`.

---

## Integration Points for Teammates

### Auth teammate

- **Where to add middleware**: see the `// --- Auth middleware should slot in HERE ---`
  comment in `server.js`, between `metricsRouter` and `generalLimiter`.
- **Config**: add `JWT_SECRET` (and any other auth vars) to `config/env.js`.
  The placeholder already exists in `.env.example`.
- **Error handling**: throw `new AppError('Unauthorized', 401, 'UNAUTHORIZED')`
  from your auth middleware — the centralised error handler will serialise it.
- **Health endpoint**: `/health` and `/ready` are intentionally placed *above*
  the auth middleware so they remain unauthenticated (as required by Docker
  health checks and load balancers).

### DB teammate

- **Health readiness**: in [`routes/health.js`](routes/health.js), the `/ready`
  endpoint has a commented-out `checkDb()` stub. Implement this function to
  ping the database and return the result. Flip the response to `503` if the
  DB is unreachable.
- **Config**: add `DATABASE_URL` to `config/env.js`. The placeholder already
  exists in `.env.example`.
- **Docker Compose**: a `db` service placeholder comment exists in
  [`docker-compose.yml`](../docker-compose.yml).

---

## Directory Structure

```
Backend/
├── config/
│   ├── env.js              # Centralised environment config
│   └── logger.js           # Pino logger + pino-http setup
├── middleware/
│   ├── errorHandler.js     # AppError class, asyncHandler, 404, error MW
│   ├── rateLimiter.js      # express-rate-limit (general + strict)
│   └── validate.js         # Zod validation middleware + schemas
├── routes/
│   ├── health.js           # /health (liveness) + /ready (readiness)
│   └── metrics.js          # /metrics (Prometheus scrape)
├── tests/
│   ├── errorHandler.test.js
│   ├── validate.test.js
│   └── rateLimiter.test.js
├── server.js               # App bootstrap + routes + shutdown
├── Dockerfile
├── .env.example
├── ARCHITECTURE.md         # ← This file
└── package.json
```
