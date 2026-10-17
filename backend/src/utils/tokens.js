import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.JWT.ACCESS_SECRET,
    {
      expiresIn: env.JWT.ACCESS_EXPIRES_IN,
    }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      tokenId: crypto.randomBytes(16).toString('hex'),
    },
    env.JWT.REFRESH_SECRET,
    {
      expiresIn: env.JWT.REFRESH_EXPIRES_IN,
    }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT.ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT.REFRESH_SECRET);
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
