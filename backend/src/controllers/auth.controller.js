import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config/env.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ProfileRepository } from '../repositories/profile.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export const registerSchema = z.object({
  email: z.string().email('Valid email address is required.').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters long.')
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required.'),
  password: z.string().min(1, 'Password is required.')
});

export class AuthController {
  static async register(req, res, next) {
    try {
      const { email, password } = req.body;

      const existing = UserRepository.findByEmail(email);
      if (existing) {
        return res.status(409).json({
          data: null,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists.'
          },
          meta: { requestId: req.id }
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = UserRepository.create({ email, passwordHash });

      // Create JWT session token
      const tokenId = crypto.randomUUID();
      const token = jwt.sign(
        { sub: user.id, email: user.email, jti: tokenId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      // Set secure HTTP-only SameSite cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      AuditRepository.record({
        userId: user.id,
        eventType: 'USER_REGISTERED',
        requestId: req.id,
        metadata: { email: user.email }
      });

      return res.status(201).json({
        data: {
          user: { id: user.id, email: user.email }
        },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = UserRepository.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          },
          meta: { requestId: req.id }
        });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.'
          },
          meta: { requestId: req.id }
        });
      }

      // Generate session token
      const tokenId = crypto.randomUUID();
      const token = jwt.sign(
        { sub: user.id, email: user.email, jti: tokenId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      AuditRepository.record({
        userId: user.id,
        eventType: 'USER_LOGGED_IN',
        requestId: req.id
      });

      return res.json({
        data: {
          user: { id: user.id, email: user.email }
        },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }

  static logout(req, res, next) {
    try {
      if (req.user && req.user.jti) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        UserRepository.revokeToken(req.user.jti, req.user.id, expiresAt);
      }

      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        path: '/'
      });

      if (req.user) {
        AuditRepository.record({
          userId: req.user.id,
          eventType: 'USER_LOGGED_OUT',
          requestId: req.id
        });
      }

      return res.json({
        data: { message: 'Logged out successfully.' },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }

  static me(req, res, next) {
    try {
      const user = UserRepository.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          data: null,
          error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
          meta: { requestId: req.id }
        });
      }

      const profile = ProfileRepository.findByUserId(req.user.id);

      return res.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            profile
          }
        },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }
}
