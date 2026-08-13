import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

// General limiter for all API traffic
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
});

// Stricter limiter for endpoints that mutate state / cost more (checkout, assistant, backtest)
export const strictLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: Math.max(10, Math.floor(config.rateLimit.max / 5)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests to this endpoint, please slow down.' },
});
