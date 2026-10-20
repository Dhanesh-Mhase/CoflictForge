import { verifyAccessToken } from '../utils/tokens.js';
import { UnauthorizedError } from '../utils/errors.js';

export const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(
      new UnauthorizedError('Authentication token is required.', 'TOKEN_MISSING')
    );
  }

  try {
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(
        new UnauthorizedError('Access token has expired.', 'TOKEN_EXPIRED')
      );
    }

    return next(
      new UnauthorizedError('Invalid authentication token.', 'TOKEN_INVALID')
    );
  }
};
