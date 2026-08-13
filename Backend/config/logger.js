import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { config, isProd } from './env.js';

export const logger = pino({
  level: config.logLevel,
  transport: isProd
    ? undefined // structured JSON in prod, ready for log aggregators (ELK/Datadog/CloudWatch)
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
});

// Attaches a per-request logger (req.log) with a unique request id,
// so every log line for a request can be traced across the whole lifecycle.
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existingId = req.headers['x-request-id'];
    const id = existingId || randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
