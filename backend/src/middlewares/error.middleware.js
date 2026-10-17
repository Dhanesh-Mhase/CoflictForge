import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred.';

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Malformed JSON body provided.';
  }

  if (err.code === 'P2002') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'A record with this identifier already exists.';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    errorCode = 'RECORD_NOT_FOUND';
    message = 'Requested record was not found.';
  }

  const isOperational = err instanceof AppError && err.isOperational;
  if (env.isProduction && !isOperational) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  if (statusCode >= 500) {
    console.error(`[SERVER ERROR] ${req.method} ${req.url}:`, err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {}),
    },
  });
};
