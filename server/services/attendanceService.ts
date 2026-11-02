import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface CheckInInput {
  employee_id: number;
  store_id?: number;
  timestamp?: string; // ISO string or default now
  notes?: string;
}

export interface CheckOutInput {
  employee_id: number;
  timestamp?: string; // ISO string or default now
  notes?: string;
}

export interface ManualAttendanceInput {
  employee_id: number;
  store_id?: number;
  date: string; // YYYY-MM-DD
  check_in?: string; // HH:mm or ISO
  check_out?: string;
  status: 'present' | 'absent' | 'half_day' | 'on_leave';
  notes?: string;
  working_hours?: number;
  overtime_hours?: number;
}

export const attendanceService = {
  /**
   * List attendance logs with multi-store & employee details
   */
  async getAttendance(businessId: number, filters: {
    date?: string;
    start_date?: string;
    end_date?: string;
    store_id?: number;
    employee_id?: number;
    department_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT 
        a.*,
        e.name as employee_name,
        e.employee_code,
        e.designation,
        d.name as department_name,
        s.name as store_name,
        s.code as store_code,
        u.name as corrected_by_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON a.store_id = s.id
      LEFT JOIN users u ON a.corrected_by = u.id
      WHERE a.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.date) {
      query += ' AND a.date = ?';
      params.push(filters.date);
    }

    if (filters.start_date && filters.end_date) {
      query += ' AND a.date BETWEEN ? AND ?';
      params.push(filters.start_date, filters.end_date);
    } else if (filters.start_date) {
      query += ' AND a.date >= ?';
      params.push(filters.start_date);
    }

    if (filters.store_id) {
      query += ' AND a.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.employee_id) {
      query += ' AND a.employee_id = ?';
      params.push(filters.employee_id);
    }

    if (filters.department_id) {
      query += ' AND e.department_id = ?';
      params.push(filters.department_id);
    }

    if (filters.status) {
      query += ' AND a.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY a.date DESC, a.check_in DESC';

    if (filters.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      attendance_date: r.date,
      check_in_time: r.check_in,
      check_out_time: r.check_out,
      working_hours: Number(r.working_hours || 0),
      total_working_hours: Number(r.working_hours || 0),
      overtime_hours: Number(r.overtime_hours || 0),
      late_mins: Number(r.late_mins || 0),
      late_minutes: Number(r.late_mins || 0),
      is_corrected: Boolean(r.is_corrected),
      is_manually_corrected: Boolean(r.is_corrected)
    }));
  },

  /**
   * Unified punch helper
   */
  async punch(businessId: number, employeeId: number, type: 'in' | 'out', notes?: string) {
    if (type === 'in') {
      const rec = await this.checkIn(businessId, { employee_id: employeeId, notes });
      return {
        ...rec,
        check_in_time: rec.check_in,
        check_out_time: rec.check_out,
        total_working_hours: Number(rec.working_hours || 0)
      };
    } else {
      const rec = await this.checkOut(businessId, { employee_id: employeeId, notes });
      return {
        ...rec,
        check_in_time: rec.check_in,
        check_out_time: rec.check_out,
        total_working_hours: Number(rec.working_hours || 0)
      };
    }
  },

  /**
   * Daily attendance summary (present, absent, late, half-day)
   */
  async getTodaySummary(businessId: number, storeId?: number, date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    let baseEmpWhere = "WHERE business_id = ? AND employment_status = 'active'";
    const empParams: any[] = [businessId];
    if (storeId) {
      baseEmpWhere += ' AND store_id = ?';
      empParams.push(storeId);
    }

    const totalActiveEmpRes = await db.queryOne(`SELECT COUNT(*) as cnt FROM employees ${baseEmpWhere}`, empParams);
    const totalActive = Number(totalActiveEmpRes?.cnt || 0);

    let attWhere = 'WHERE a.business_id = ? AND a.date = ?';
    const attParams: any[] = [businessId, targetDate];
    if (storeId) {
      attWhere += ' AND a.store_id = ?';
      attParams.push(storeId);
    }

    const attCounts = await db.query(`
      SELECT a.status, COUNT(*) as cnt, SUM(CASE WHEN a.late_mins > 0 THEN 1 ELSE 0 END) as late_cnt
      FROM attendance a
      ${attWhere}
      GROUP BY a.status
    `, attParams);

    let present = 0;
    let halfDay = 0;
    let onLeave = 0;
    let late = 0;

    for (const c of attCounts) {
      if (c.status === 'present') present += Number(c.cnt);
      if (c.status === 'half_day') halfDay += Number(c.cnt);
      if (c.status === 'on_leave') onLeave += Number(c.cnt);
      late += Number(c.late_cnt || 0);
    }

    const markedTotal = present + halfDay + onLeave;
    const absent = Math.max(0, totalActive - markedTotal);

    return {
      date: targetDate,
      totalActiveEmployees: totalActive,
      present,
      halfDay,
      absent,
      onLeave,
      lateArrivals: late,
      attendancePercentage: totalActive > 0 ? Number(((present + halfDay * 0.5) / totalActive * 100).toFixed(1)) : 0
    };
  },

  /**
   * Employee Check-In (Punch In)
   */
  async checkIn(businessId: number, data: CheckInInput) {
    const { employee_id } = data;
    const now = data.timestamp ? new Date(data.timestamp) : new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const employee = await db.queryOne(
      'SELECT id, store_id, shift_id, name, employee_code FROM employees WHERE business_id = ? AND id = ?',
      [businessId, employee_id]
    );
    if (!employee) throw new Error('Employee not found in your business.');

    const storeId = data.store_id || employee.store_id;

    // Guard: Prevent duplicate check-in on the same date!
    const existing = await db.queryOne(
      'SELECT id, check_in FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, todayStr]
    );

    if (existing && existing.check_in) {
      throw new Error(`Employee ${employee.name} has already checked in today at ${new Date(existing.check_in).toLocaleTimeString('en-IN')}.`);
    }

    // Determine late arrival minutes against configured shift
    let lateMins = 0;
    if (employee.shift_id) {
      const shift = await db.queryOne('SELECT * FROM shifts WHERE id = ?', [employee.shift_id]);
      if (shift && shift.start_time) {
        const [shiftHours, shiftMins] = shift.start_time.split(':').map(Number);
        const shiftStart = new Date(now);
        shiftStart.setHours(shiftHours, shiftMins + Number(shift.grace_period_mins || 0), 0, 0);

        if (now.getTime() > shiftStart.getTime()) {
          lateMins = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
        }
      }
    }

    const nowIso = now.toISOString();

    if (existing) {
      // Update record if an absent/on-leave entry pre-existed
      await db.execute(`
        UPDATE attendance SET
          store_id = ?, check_in = ?, status = 'present', late_mins = ?, notes = ?
        WHERE id = ?
      `, [storeId, nowIso, lateMins, data.notes || null, existing.id]);
    } else {
      await db.execute(`
        INSERT INTO attendance (
          business_id, store_id, employee_id, date, check_in, status, late_mins, notes
        ) VALUES (?, ?, ?, ?, ?, 'present', ?, ?)
      `, [businessId, storeId, employee_id, todayStr, nowIso, lateMins, data.notes || null]);
    }

    await auditService.log({
      businessId,
      storeId,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'attendance',
      entityId: employee_id,
      details: { employee: employee.name, time: nowIso, lateMins }
    });

    return db.queryOne('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, todayStr]);
  },

  /**
   * Employee Check-Out (Punch Out) & Overtime / Total Hours Calculation
   */
  async checkOut(businessId: number, data: CheckOutInput) {
    const { employee_id } = data;
    const now = data.timestamp ? new Date(data.timestamp) : new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const record = await db.queryOne(`
      SELECT a.*, e.shift_id, e.name as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.business_id = ? AND a.employee_id = ? AND a.date = ?
    `, [businessId, employee_id, todayStr]);

    if (!record || !record.check_in) {
      throw new Error('Check-in record for today not found. Please punch in first.');
    }

    if (record.check_out) {
      throw new Error(`Employee ${record.employee_name} has already checked out today at ${new Date(record.check_out).toLocaleTimeString('en-IN')}.`);
    }

    const checkInTime = new Date(record.check_in);
    const durationMs = now.getTime() - checkInTime.getTime();
    if (durationMs < 0) throw new Error('Check-out time cannot be earlier than check-in time.');

    const totalHours = Number((durationMs / 3600000).toFixed(2));

    // Determine shift working hours (standard 9.0 hrs)
    let standardHours = 9.0;
    if (record.shift_id) {
      const shift = await db.queryOne('SELECT working_hours FROM shifts WHERE id = ?', [record.shift_id]);
      if (shift) standardHours = Number(shift.working_hours || 9.0);
    }

    // Overtime calculation
    const overtimeHours = totalHours > standardHours ? Number((totalHours - standardHours).toFixed(2)) : 0;
    const status = totalHours < 4.5 ? 'half_day' : 'present';

    const nowIso = now.toISOString();

    await db.execute(`
      UPDATE attendance SET
        check_out = ?,
        working_hours = ?,
        overtime_hours = ?,
        status = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [nowIso, totalHours, overtimeHours, status, data.notes || null, record.id]);

    await auditService.log({
      businessId,
      storeId: record.store_id,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'attendance',
      entityId: record.id,
      details: { employee: record.employee_name, workingHours: totalHours, overtimeHours }
    });

    return db.queryOne('SELECT * FROM attendance WHERE id = ?', [record.id]);
  },

  /**
   * Manual entry or correction by Manager/HR with Audit Tracking
   */
  async correctAttendance(businessId: number, arg2: any, arg3?: any, arg4?: any) {
    let attendanceId: number;
    let managerUserId: number = 1;
    let updates: any;

    if (typeof arg2 === 'object') {
      attendanceId = Number(arg2.attendanceId || arg2.attendance_id || arg2.id);
      managerUserId = Number(arg2.correctedBy || arg2.corrected_by || 1);
      updates = {
        status: arg2.status,
        check_in: arg2.check_in || arg2.checkInTime,
        check_out: arg2.check_out || arg2.checkOutTime,
        working_hours: arg2.working_hours || arg2.workingHours,
        overtime_hours: arg2.overtime_hours || arg2.overtimeHours,
        notes: arg2.notes || arg2.reason,
      };
    } else {
      attendanceId = Number(arg2);
      managerUserId = Number(arg3 || 1);
      updates = arg4 || {};
    }

    const existing = await db.queryOne(
      'SELECT a.*, e.name as employee_name FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.business_id = ? AND a.id = ?',
      [businessId, attendanceId]
    );
    if (!existing) throw new Error('Attendance record not found.');

    const updatedWorkingHours = updates.working_hours !== undefined ? updates.working_hours : existing.working_hours;
    const updatedOvertime = updates.overtime_hours !== undefined ? updates.overtime_hours : existing.overtime_hours;
    const updatedStatus = updates.status || existing.status;

    await db.execute(`
      UPDATE attendance SET
        status = ?,
        check_in = ?,
        check_out = ?,
        working_hours = ?,
        overtime_hours = ?,
        notes = ?,
        is_corrected = 1,
        corrected_by = ?,
        corrected_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      updatedStatus,
      updates.check_in || existing.check_in,
      updates.check_out || existing.check_out,
      updatedWorkingHours,
      updatedOvertime,
      updates.notes ? `${existing.notes ? existing.notes + ' | ' : ''}Correction: ${updates.notes}` : existing.notes,
      managerUserId,
      attendanceId
    ]);

    await auditService.log({
      businessId,
      storeId: existing.store_id,
      userId: managerUserId,
      action: 'ATTENDANCE_CORRECTED',
      entityType: 'attendance',
      entityId: attendanceId,
      details: {
        employee: existing.employee_name,
        previousStatus: existing.status,
        newStatus: updatedStatus,
        reason: updates.notes
      }
    });

    const result = await db.queryOne('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    return {
      ...result,
      is_corrected: Boolean(result.is_corrected),
      is_manually_corrected: Boolean(result.is_corrected)
    };
  }
};
