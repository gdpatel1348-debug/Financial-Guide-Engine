import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class UserRepository {
  static create({ email, passwordHash }) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, normalizedEmail, passwordHash, now, now);

    return { id, email: normalizedEmail, createdAt: now, updatedAt: now };
  }

  static findByEmail(email) {
    const db = getDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  }

  static findById(id) {
    const db = getDatabase();
    const user = db.prepare('SELECT id, email, created_at, updated_at FROM users WHERE id = ?').get(id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }

  static revokeToken(tokenId, userId, expiresAt) {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO token_revocations (token_id, user_id, revoked_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenId, userId, now, expiresAt);
  }

  static isTokenRevoked(tokenId) {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 FROM token_revocations WHERE token_id = ?').get(tokenId);
    return Boolean(row);
  }
}
