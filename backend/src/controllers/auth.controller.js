import { authService } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { serializeResponse, deserializeBody } from '../utils/serializers.js';
import { BadRequestError, asyncHandler } from '../utils/errors.js';

export const serializeUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    avatarUrl: user.avatarUrl || null,
    createdAt: user.createdAt,
  };
};

const deserializeSigninInput = (body) => {
  const { idToken } = deserializeBody(body, ['idToken']);
  return { idToken };
};

const deserializeRefreshInput = (req) => {
  const token = req.cookies?.refreshToken;

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new BadRequestError('No refresh session found', 'MISSING_REFRESH_TOKEN');
  }

  return {
    refreshToken: token.trim(),
  };
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: env.JWT.REFRESH_MAX_AGE_MS,
});

export const authController = {
  signin: asyncHandler(async (req, res) => {
    const { idToken } = deserializeSigninInput(req.body);
    const { user, accessToken, refreshToken } = await authService.signinWithGoogle(idToken);

    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    return res.status(200).json(
      serializeResponse(
        {
          accessToken,
          user: serializeUser(user),
        },
        'Authentication successful.'
      )
    );
  }),

  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = deserializeRefreshInput(req);
    const { user, accessToken, newRefreshToken } = await authService.refreshSession(refreshToken);

    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    return res.status(200).json(
      serializeResponse(
        {
          accessToken,
          user: serializeUser(user),
        },
        'Session refreshed successfully.'
      )
    );
  }),

  signout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await authService.signout(refreshToken);
    }

    res.clearCookie('refreshToken', getRefreshCookieOptions());

    return res.status(200).json(
      serializeResponse(null, 'Signed out successfully.')
    );
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.id);

    return res.status(200).json(
      serializeResponse(
        {
          user: serializeUser(user),
        },
        'User profile retrieved.'
      )
    );
  }),
};
