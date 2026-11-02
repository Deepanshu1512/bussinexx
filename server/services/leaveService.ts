import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface LeaveApplicationInput {
  employee_id: number;
  leave_type: 'casual' | 'sick' | 'paid' | 'unpaid';
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason: string;
}

export const leaveService = {
  /**
   * List leave applications with employee & reviewer info
   */
  async getLeaveApplications(businessId: number, filters: {
    employee_id?: number;
    store_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT 
        l.*,
        e.name as employee_name,
        e.employee_code,
        e.designation,
        d.name as department_name,
        s.name as store_name,
        u.name as reviewer_name
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON e.store_id = s.id
      LEFT JOIN users u ON l.reviewed_by = u.id
      WHERE l.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.employee_id) {
      query += ' AND l.employee_id = ?';
      params.push(filters.employee_id);
    }

    if (filters.store_id) {
      query += ' AND e.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.status) {
      query += ' AND l.status = ?';
      params.push(filters.status);
    }

    if (filters.start_date && filters.end_date) {
      query += ' AND l.start_date <= ? AND l.end_date >= ?';
      params.push(filters.end_date, filters.start_date);
    }

    query += ' ORDER BY l.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      days_count: Number(r.days_count || 1.0)
    }));
  },

  /**
   * Retrieve leave balances for an employee
   */
  async getLeaveBalances(businessId: number, employeeId: number, year?: number) {
    const targetYear = year || new Date().getFullYear();
    let balance = await db.queryOne(`
      SELECT * FROM leave_balances WHERE business_id = ? AND employee_id = ? AND year = ?
    `, [businessId, employeeId, targetYear]);

    if (!balance) {
      // Auto-provision if not exists
      await db.execute(`
        INSERT INTO leave_balances (business_id, employee_id, year, casual_total, casual_used, sick_total, sick_used, paid_total, paid_used, unpaid_used)
        VALUES (?, ?, ?, 12.0, 0.0, 12.0, 0.0, 15.0, 0.0, 0.0)
      `, [businessId, employeeId, targetYear]);

      balance = await db.queryOne(`
        SELECT * FROM leave_balances WHERE business_id = ? AND employee_id = ? AND year = ?
      `, [businessId, employeeId, targetYear]);
    }

    return {
      year: targetYear,
      casual_total: Number(balance.casual_total || 12),
      casual_used: Number(balance.casual_used || 0),
      casual_available: Math.max(0, Number(balance.casual_total || 12) - Number(balance.casual_used || 0)),
      casual_leave_total: Number(balance.casual_total || 12),
      casual_leave_used: Number(balance.casual_used || 0),
      sick_total: Number(balance.sick_total || 12),
      sick_used: Number(balance.sick_used || 0),
      sick_available: Math.max(0, Number(balance.sick_total || 12) - Number(balance.sick_used || 0)),
      sick_leave_total: Number(balance.sick_total || 12),
      sick_leave_used: Number(balance.sick_used || 0),
      paid_total: Number(balance.paid_total || 15),
      paid_used: Number(balance.paid_used || 0),
      paid_available: Math.max(0, Number(balance.paid_total || 15) - Number(balance.paid_used || 0)),
      paid_leave_total: Number(balance.paid_total || 15),
      paid_leave_used: Number(balance.paid_used || 0),
      unpaid_used: Number(balance.unpaid_used || 0),
      unpaid_leave_used: Number(balance.unpaid_used || 0)
    };
  },

  async getBalance(businessId: number, employeeId: number, year?: number) {
    return this.getLeaveBalances(businessId, employeeId, year);
  },

  async getLeaves(businessId: number, filters: any = {}) {
    return this.getLeaveApplications(businessId, filters);
  },

  /**
   * Submit a new leave application
   */
  async applyLeave(businessId: number, data: any) {
    const employee_id = data.employee_id || data.employeeId;
    const leave_type = data.leave_type || data.leaveType;
    const start_date = data.start_date || data.startDate;
    const end_date = data.end_date || data.endDate;
    const reason = data.reason;

    if (!employee_id || !start_date || !end_date || !reason) {
      throw new Error('Employee, dates, and reason are required to apply for leave.');
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end.getTime() < start.getTime()) {
      throw new Error('End date cannot be earlier than start date.');
    }

    // Calculate calendar days
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const employee = await db.queryOne('SELECT id, name, store_id FROM employees WHERE business_id = ? AND id = ?', [businessId, employee_id]);
    if (!employee) throw new Error('Employee not found.');

    const res = await db.execute(`
      INSERT INTO leaves (
        business_id, employee_id, leave_type, start_date, end_date, days_count, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      businessId,
      employee_id,
      leave_type,
      start_date,
      end_date,
      diffDays,
      reason.trim()
    ]);

    const leaveId = Number(res.lastInsertId);

    // Notify managers
    await db.execute(`
      INSERT INTO notifications (business_id, type, title, message, link)
      VALUES (?, 'leave_request', 'New Leave Application', ?, '/leaves')
    `, [
      businessId,
      `${employee.name} applied for ${diffDays} day(s) ${leave_type} leave (${start_date} to ${end_date}).`
    ]);

    await auditService.log({
      businessId,
      storeId: employee.store_id,
      action: 'LEAVE_APPLIED',
      entityType: 'leave',
      entityId: leaveId,
      details: { employee: employee.name, leaveType: leave_type, daysCount: diffDays }
    });

    const created = await db.queryOne('SELECT * FROM leaves WHERE id = ?', [leaveId]);
    return {
      ...created,
      total_days: Number(created.days_count || diffDays)
    };
  },

  /**
   * Manager review: Approve or Reject leave application
   */
  async reviewLeave(businessId: number, leaveId: number, arg3: any, arg4?: any) {
    let reviewerUserId = 1;
    let review: { status: 'approved' | 'rejected'; review_notes?: string; managerRemarks?: string };

    if (typeof arg3 === 'number') {
      reviewerUserId = arg3;
      review = arg4 || { status: 'approved' };
    } else {
      review = arg3 || { status: 'approved' };
      reviewerUserId = (review as any).reviewedBy || 1;
    }

    const leave = await db.queryOne(`
      SELECT l.*, e.name as employee_name, e.store_id
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.business_id = ? AND l.id = ?
    `, [businessId, leaveId]);

    if (!leave) throw new Error('Leave application not found.');
    if (leave.status !== 'pending') {
      throw new Error(`This leave application has already been ${leave.status}.`);
    }

    const { status } = review;
    const review_notes = review.review_notes || review.managerRemarks;

    if (status === 'approved') {
      const year = new Date(leave.start_date).getFullYear();
      const days = Number(leave.days_count || 1);

      // Update leave balance
      if (leave.leave_type === 'casual') {
        await db.execute('UPDATE leave_balances SET casual_used = casual_used + ? WHERE employee_id = ? AND year = ?', [days, leave.employee_id, year]);
      } else if (leave.leave_type === 'sick') {
        await db.execute('UPDATE leave_balances SET sick_used = sick_used + ? WHERE employee_id = ? AND year = ?', [days, leave.employee_id, year]);
      } else if (leave.leave_type === 'paid') {
        await db.execute('UPDATE leave_balances SET paid_used = paid_used + ? WHERE employee_id = ? AND year = ?', [days, leave.employee_id, year]);
      } else if (leave.leave_type === 'unpaid') {
        await db.execute('UPDATE leave_balances SET unpaid_used = unpaid_used + ? WHERE employee_id = ? AND year = ?', [days, leave.employee_id, year]);
      }

      // Automatically reflect in attendance table for each day of the leave!
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const curr = new Date(start);

      while (curr.getTime() <= end.getTime()) {
        const dateStr = curr.toISOString().slice(0, 10);
        const existingAtt = await db.queryOne(
          'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
          [leave.employee_id, dateStr]
        );

        if (existingAtt) {
          await db.execute("UPDATE attendance SET status = 'on_leave', notes = ? WHERE id = ?", [
            `Approved ${leave.leave_type} leave`,
            existingAtt.id
          ]);
        } else {
          await db.execute(`
            INSERT INTO attendance (business_id, store_id, employee_id, date, status, notes)
            VALUES (?, ?, ?, ?, 'on_leave', ?)
          `, [businessId, leave.store_id, leave.employee_id, dateStr, `Approved ${leave.leave_type} leave`]);
        }

        curr.setDate(curr.getDate() + 1);
      }
    }

    await db.execute(`
      UPDATE leaves SET
        status = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = ?
      WHERE id = ?
    `, [status, reviewerUserId, review_notes || null, leaveId]);

    // Create notification
    await db.execute(`
      INSERT INTO notifications (business_id, type, title, message, link)
      VALUES (?, 'system', 'Leave Application Update', ?, '/leaves')
    `, [
      businessId,
      `Leave application for ${leave.employee_name} (${leave.start_date} to ${leave.end_date}) has been ${status}.`
    ]);

    await auditService.log({
      businessId,
      storeId: leave.store_id,
      userId: reviewerUserId,
      action: status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      entityType: 'leave',
      entityId: leaveId,
      details: { employee: leave.employee_name, status, notes: review_notes }
    });

    return db.queryOne('SELECT * FROM leaves WHERE id = ?', [leaveId]);
  }
};
