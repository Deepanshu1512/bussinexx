import { db } from '../db/database.ts';

export const auditService = {
  async log(params: {
    businessId: number;
    storeId?: number | null;
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    details?: string | Record<string, any>;
  }) {
    try {
      const detailsStr = typeof params.details === 'object'
        ? JSON.stringify(params.details)
        : (params.details || '');

      await db.execute(`
        INSERT INTO audit_logs (business_id, store_id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        params.businessId,
        params.storeId || null,
        params.userId || null,
        params.action,
        params.entityType,
        params.entityId ? String(params.entityId) : null,
        detailsStr
      ]);
    } catch (err) {
      console.warn('Audit log write error:', err);
    }
  },

  async getLogs(businessId: number, options: { storeId?: number; limit?: number; offset?: number } = {}) {
    let query = 'SELECT * FROM audit_logs WHERE business_id = ?';
    const params: any[] = [businessId];

    if (options.storeId) {
      query += ' AND store_id = ?';
      params.push(options.storeId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);

    return db.query(query, params);
  }
};
