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
  ollama: {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '8000', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 min
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 req/min/IP
  },
};

export const isProd = config.env === 'production';
