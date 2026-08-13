import dotenv from 'dotenv';
dotenv.config();

// Central place for all environment-driven config.
// Teammates adding DB/auth should add their vars here too (e.g. DATABASE_URL, JWT_SECRET)
// instead of reading process.env directly all over the codebase.
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 min
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 req/min/IP
  },
};

export const isProd = config.env === 'production';
