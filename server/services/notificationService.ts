import { db } from '../db/database.ts';

export interface NotificationInput {
  user_id?: number | null;
  type: 'low_stock' | 'leave_request' | 'payroll_due' | 'payment_due' | 'system';
  title: string;
  message: string;
  link?: string;
}

export const notificationService = {
  /**
   * List notifications for a business
   */
  async getNotifications(businessId: number, options: { unread_only?: boolean; limit?: number; offset?: number } = {}) {
    let query = 'SELECT * FROM notifications WHERE business_id = ?';
    const params: any[] = [businessId];

    if (options.unread_only) {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 20, options.offset || 0);

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      module: r.type?.includes('stock') ? 'inventory' : (r.type?.includes('leave') ? 'leaves' : (r.type?.includes('payroll') ? 'payroll' : 'system')),
      is_read: Boolean(r.is_read)
    }));
  },

  /**
   * Get total unread count
   */
  async getUnreadCount(businessId: number) {
    const res = await db.queryOne(
      'SELECT COUNT(*) as count FROM notifications WHERE business_id = ? AND is_read = 0',
      [businessId]
    );
    return Number(res?.count || 0);
  },

  /**
   * Mark single notification as read
   */
  async markAsRead(businessId: number, id: number) {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE business_id = ? AND id = ?',
      [businessId, id]
    );
    return { success: true };
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(businessId: number) {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE business_id = ?',
      [businessId]
    );
    return { success: true };
  },

  /**
   * Create notification
   */
  async createNotification(businessId: number, data: NotificationInput) {
    const res = await db.execute(`
      INSERT INTO notifications (business_id, user_id, type, title, message, link, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `, [
      businessId,
      data.user_id || null,
      data.type,
      data.title.trim(),
      data.message.trim(),
      data.link || null
    ]);
    return db.queryOne('SELECT * FROM notifications WHERE id = ?', [Number(res.lastInsertId)]);
  },

  /**
   * Scan system state and create automated alerts (low stock, pending leaves, pending payroll)
   */
  async checkAutomatedAlerts(businessId: number) {
    const alertsCreated: string[] = [];

    // 1. Low Stock Products Check
    const lowStock = await db.query(`
      SELECT name, current_stock, min_stock_threshold FROM products
      WHERE business_id = ? AND status = 'active' AND current_stock <= min_stock_threshold
      LIMIT 3
    `, [businessId]);

    for (const item of lowStock) {
      const existing = await db.queryOne(`
        SELECT id FROM notifications 
        WHERE business_id = ? AND type = 'low_stock' AND message LIKE ? 
        AND created_at >= date('now', '-1 day')
      `, [businessId, `%${item.name}%`]);

      if (!existing) {
        await this.createNotification(businessId, {
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `Product '${item.name}' is running low (${item.current_stock} remaining, min threshold: ${item.min_stock_threshold}).`,
          link: '/inventory'
        });
        alertsCreated.push(`Low stock alert: ${item.name}`);
      }
    }

    // 2. Pending Leave Requests Check
    const pendingLeaves = await db.queryOne(
      "SELECT count(*) as cnt FROM leaves WHERE business_id = ? AND status = 'pending'",
      [businessId]
    );
    const pendingLeaveCount = Number(pendingLeaves?.cnt || 0);
    if (pendingLeaveCount > 0) {
      const existing = await db.queryOne(`
        SELECT id FROM notifications 
        WHERE business_id = ? AND type = 'leave_request' AND created_at >= date('now', '-1 day')
      `, [businessId]);

      if (!existing) {
        await this.createNotification(businessId, {
          type: 'leave_request',
          title: 'Pending Leave Applications',
          message: `You have ${pendingLeaveCount} employee leave application(s) awaiting manager review.`,
          link: '/leaves'
        });
        alertsCreated.push('Pending leave applications reminder');
      }
    }

    return { success: true, alertsCreated };
  },

  async scanAndGenerateAlerts(businessId: number) {
    const res = await this.checkAutomatedAlerts(businessId);
    return { success: true, added: res.alertsCreated.length };
  }
};
