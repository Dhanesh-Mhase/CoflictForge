import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { userRepository } from '../repository/user.repository.js';
import { tokenRepository } from '../repository/token.repository.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/tokens.js';
import { UnauthorizedError, NotFoundError } from '../utils/errors.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const authService = {
  async signinWithGoogle(idToken) {
    let payload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw new UnauthorizedError('Invalid authentication credentials.', 'AUTH_FAILED');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedError('Invalid authentication credentials.', 'AUTH_FAILED');
    }

    const user = await userRepository.upsertGoogleUser({
      email: payload.email,
      name: payload.name || payload.given_name || 'User',
      avatarUrl: payload.picture || null,
      googleId: payload.sub,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.JWT.REFRESH_MAX_AGE_MS);

    await tokenRepository.createToken({
      tokenHash,
      userId: user.id,
      expiresAt,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  },

  async refreshSession(rawRefreshToken) {
    let decoded;

    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired session. Please sign in again.', 'TOKEN_EXPIRED');
    }

    const oldTokenHash = hashToken(rawRefreshToken);
    const savedToken = await tokenRepository.findByTokenHash(oldTokenHash);

    if (!savedToken) {
      throw new UnauthorizedError('Invalid or expired session. Please sign in again.', 'SESSION_REVOKED');
    }

    const user = savedToken.user;
    if (!user) {
      throw new UnauthorizedError('User account no longer exists.', 'USER_NOT_FOUND');
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + env.JWT.REFRESH_MAX_AGE_MS);

    await tokenRepository.rotateToken({
      oldTokenHash,
      newTokenHash,
      userId: user.id,
      expiresAt,
    });

    return {
      user,
      accessToken: newAccessToken,
      newRefreshToken,
    };
  },

  async signout(rawRefreshToken) {
    if (!rawRefreshToken) return true;

    const tokenHash = hashToken(rawRefreshToken);
    await tokenRepository.deleteByTokenHash(tokenHash);
    return true;
  },

  async getCurrentUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.', 'USER_NOT_FOUND');
    }
    return user;
  },
};
