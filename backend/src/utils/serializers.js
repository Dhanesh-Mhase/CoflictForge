import { BadRequestError } from './errors.js';

export const normalizeBigInt = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeBigInt);
  if (typeof value === 'object') {
    if (value instanceof Date) return value;
    const copy = {};
    for (const [key, val] of Object.entries(value)) {
      copy[key] = normalizeBigInt(val);
    }
    return copy;
  }
  return value;
};

export const serializeResponse = (data = null, message = 'Success') => {
  return {
    success: true,
    message,
    data: normalizeBigInt(data),
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
