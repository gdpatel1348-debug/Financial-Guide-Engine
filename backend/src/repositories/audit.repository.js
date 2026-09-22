import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class AuditRepository {
  static record({ userId = null, eventType, resourceType = null, resourceId = null, requestId = null, metadata = {} }) {
    try {
      const db = getDatabase();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      // Redact sensitive keys from metadata
      const safeMeta = { ...metadata };
      delete safeMeta.password;
      delete safeMeta.passwordHash;
      delete safeMeta.token;
      delete safeMeta.cookie;

      db.prepare(`
        INSERT INTO audit_events (
          id, user_id, event_type, resource_type, resource_id, request_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        eventType,
        resourceType,
        resourceId,
        requestId,
        JSON.stringify(safeMeta),
        now
      );
    } catch (err) {
      // Non-blocking: audit logging failures should not crash user operations
      console.error('[AuditRepository] Failed to record event:', err.message);
    }
  }
}
