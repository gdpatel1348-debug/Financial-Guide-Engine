import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { UserRepository } from '../repositories/user.repository.js';

export function requireAuth(req, res, next) {
  let token = null;

  // 1. Check HTTP-only cookie first
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }
  // 2. Fallback to Authorization Bearer header if provided
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required to access this resource.'
      },
      meta: { requestId: req.id }
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    // Check token revocation
    if (decoded.jti && UserRepository.isTokenRevoked(decoded.jti)) {
      return res.status(401).json({
        data: null,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'The session token has been revoked. Please log in again.'
        },
        meta: { requestId: req.id }
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      jti: decoded.jti
    };

    next();
  } catch (err) {
    return res.status(401).json({
      data: null,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired session token.'
      },
      meta: { requestId: req.id }
    });
  }
}
