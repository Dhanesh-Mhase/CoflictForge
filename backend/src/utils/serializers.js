import { BadRequestError } from './errors.js';

export const serializeResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    message,
    data,
  };
};

export const deserializeBody = (body, requiredFields = []) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('Invalid request payload. Expected a JSON object.', 'INVALID_BODY');
  }

  const sanitized = {};

  for (const field of requiredFields) {
    const val = body[field];

    if (val === undefined || val === null || (typeof val === 'string' && val.trim().length === 0)) {
      throw new BadRequestError(`Missing required field: ${field}`, `MISSING_${field.toUpperCase()}`);
    }

    sanitized[field] = typeof val === 'string' ? val.trim() : val;
  }

  return {
    ...body,
    ...sanitized,
  };
};
