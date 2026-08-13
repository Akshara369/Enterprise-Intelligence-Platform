// Custom error type so routes can throw meaningful, typed errors
// instead of manually building res.status(...).json(...) everywhere.
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguishes expected errors from real bugs
  }
}

// Wraps async route handlers so thrown errors / rejected promises
// automatically reach the error middleware instead of crashing the process.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler - must be registered AFTER all routes
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
    requestId: req.id,
  });
};

// Central error handler - must be registered LAST (4 args = Express error middleware)
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  req.log?.error({ err, statusCode }, err.message);

  res.status(statusCode).json({
    error: err.code || 'INTERNAL_ERROR',
    message: isOperational ? err.message : 'Something went wrong. Please try again.',
    requestId: req.id,
    // Never leak stack traces to clients in production
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

// Catches sync/async errors that slip past everything else so the
// process doesn't hard-crash and take down all users.
export const registerProcessSafetyNets = (logger) => {
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception - shutting down');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection - shutting down');
    process.exit(1);
  });
};
