import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface EmployeeInput {
  employee_code?: string;
  store_id?: number | null;
  department_id?: number | null;
  shift_id?: number | null;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  designation: string;
  joining_date?: string;
  employment_status?: string;
  basic_salary?: number;
  base_salary?: number;
  hourly_rate?: number;
  payment_method?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  pan_number?: string;
  hra?: number;
  allowances?: number;
  deductions?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  performance_rating?: number;
  documents_json?: string;
  notes?: string;
}

export const employeeService = {
  /**
   * List departments
   */
  async getDepartments(businessId: number) {
    let rows = await db.query(`
      SELECT d.*, COUNT(e.id) as employee_count 
      FROM departments d
      LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status = 'active'
      WHERE d.business_id = ?
      GROUP BY d.id
      ORDER BY d.name ASC
    `, [businessId]);

    if (rows.length === 0) {
      const defaultDepts = [
        { name: 'Sales & Store Operations', description: 'Retail sales, billing, cashier and frontline operations' },
        { name: 'Warehouse & Inventory', description: 'Stock handling, receiving, packing and dispatch' },
        { name: 'Management & Administration', description: 'Store operations, accounts and executive management' },
        { name: 'Customer Support & Service', description: 'Customer relations, returns and after-sales support' },
      ];
      for (const d of defaultDepts) {
        try {
          await db.execute(
            'INSERT INTO departments (business_id, name, description) VALUES (?, ?, ?)',
            [businessId, d.name, d.description]
          );
        } catch (e) {
          // Ignore duplicate on race condition
        }
      }
      rows = await db.query(`
        SELECT d.*, COUNT(e.id) as employee_count 
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status = 'active'
        WHERE d.business_id = ?
        GROUP BY d.id
        ORDER BY d.name ASC
      `, [businessId]);
    }

    return rows;
  },

  /**
   * Create department
   */
  async createDepartment(businessId: number, data: { name: string; description?: string; code?: string }) {
    if (!data.name || !data.name.trim()) throw new Error('Department name is required.');
    const cleanName = data.name.trim();

    const existing = await db.queryOne(
      'SELECT id FROM departments WHERE business_id = ? AND name = ?',
      [businessId, cleanName]
    );
    if (existing) throw new Error(`Department '${cleanName}' already exists.`);

    const res = await db.execute(
      'INSERT INTO departments (business_id, name, description) VALUES (?, ?, ?)',
      [businessId, cleanName, data.description?.trim() || null]
    );

    return { id: Number(res.lastInsertId), name: cleanName, description: data.description };
  },

  /**
   * List shifts
   */
  async getShifts(businessId: number) {
    let rows = await db.query(
      'SELECT * FROM shifts WHERE business_id = ? ORDER BY id ASC',
      [businessId]
    );

    if (rows.length === 0) {
      await db.execute(`
        INSERT INTO shifts (business_id, name, start_time, end_time, grace_period_mins, working_hours)
        VALUES 
          (?, 'Standard Day Shift', '09:00', '18:00', 15, 9.0),
          (?, 'Morning Store Shift', '08:00', '16:30', 15, 8.5),
          (?, 'Evening Store Shift', '14:00', '22:30', 15, 8.5)
      `, [businessId, businessId, businessId]);

      rows = await db.query(
        'SELECT * FROM shifts WHERE business_id = ? ORDER BY id ASC',
        [businessId]
      );
    }

    return rows;
  },

  /**
   * Create or update shift
   */
  async createShift(businessId: number, data: { 
    name: string; 
    start_time: string; 
    end_time: string; 
    grace_period_mins?: number;
    working_hours?: number;
  }) {
    if (!data.name || !data.start_time || !data.end_time) {
      throw new Error('Shift name, start time, and end time are required.');
    }

    const res = await db.execute(`
      INSERT INTO shifts (business_id, name, start_time, end_time, grace_period_mins, working_hours)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      data.name.trim(),
      data.start_time.trim(),
      data.end_time.trim(),
      data.grace_period_mins ?? 15,
      data.working_hours ?? 9.0
    ]);

    return { id: Number(res.lastInsertId), ...data };
  },

  /**
   * Retrieve employees with store & department metadata
   */
  async getEmployees(businessId: number, filters: {
    store_id?: number;
    department_id?: number;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    let query = `
      SELECT 
        e.*,
        d.name as department_name,
        s.name as store_name,
        s.code as store_code,
        sh.name as shift_name,
        sh.start_time as shift_start_time,
        sh.end_time as shift_end_time,
        sh.working_hours as shift_working_hours,
        (e.basic_salary + COALESCE(e.hra, 0) + COALESCE(e.allowances, 0) - COALESCE(e.deductions, 0)) as ctc_gross_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON e.store_id = s.id
      LEFT JOIN shifts sh ON e.shift_id = sh.id
      WHERE e.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.store_id) {
      query += ' AND e.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.department_id) {
      query += ' AND e.department_id = ?';
      params.push(filters.department_id);
    }

    if (filters.status) {
      query += ' AND e.employment_status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (e.name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ? OR e.phone LIKE ? OR e.designation LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    query += ' ORDER BY e.id DESC';

    if (filters.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset || 0);
    }

    const rows = await db.query(query, params);
    return rows.map(r => {
      const parts = (r.name || '').split(' ');
      return {
        ...r,
        full_name: r.name,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        base_salary: Number(r.basic_salary || 0),
        basic_salary: Number(r.basic_salary || 0),
        hourly_rate: Number(r.hourly_rate || Math.round(Number(r.basic_salary || 0) / 160)),
        payment_method: r.payment_method || 'bank_transfer',
        hra: Number(r.hra || 0),
        allowances: Number(r.allowances || 0),
        deductions: Number(r.deductions || 0),
        ctc_gross_salary: Number(r.ctc_gross_salary || 0),
        performance_rating: Number(r.performance_rating || 4.0)
      };
    });
  },

  /**
   * Retrieve single employee by ID
   */
  async getEmployeeById(businessId: number, id: number) {
    const row = await db.queryOne(`
      SELECT 
        e.*,
        d.name as department_name,
        s.name as store_name,
        s.code as store_code,
        sh.name as shift_name,
        sh.start_time as shift_start_time,
        sh.end_time as shift_end_time,
        sh.working_hours as shift_working_hours,
        (e.basic_salary + COALESCE(e.hra, 0) + COALESCE(e.allowances, 0) - COALESCE(e.deductions, 0)) as ctc_gross_salary
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON e.store_id = s.id
      LEFT JOIN shifts sh ON e.shift_id = sh.id
      WHERE e.business_id = ? AND e.id = ?
    `, [businessId, id]);

    if (!row) return null;

    // Fetch leave balances for current year
    const currentYear = new Date().getFullYear();
    const leaveBalance = await db.queryOne(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?',
      [id, currentYear]
    );

    const parts = (row.name || '').split(' ');
    return {
      ...row,
      full_name: row.name,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      base_salary: Number(row.basic_salary || 0),
      basic_salary: Number(row.basic_salary || 0),
      hourly_rate: Number(row.hourly_rate || Math.round(Number(row.basic_salary || 0) / 160)),
      payment_method: row.payment_method || 'bank_transfer',
      hra: Number(row.hra || 0),
      allowances: Number(row.allowances || 0),
      deductions: Number(row.deductions || 0),
      ctc_gross_salary: Number(row.ctc_gross_salary || 0),
      performance_rating: Number(row.performance_rating || 4.0),
      leave_balance: leaveBalance || {
        casual_total: 12, casual_used: 0,
        sick_total: 12, sick_used: 0,
        paid_total: 15, paid_used: 0,
        unpaid_used: 0
      }
    };
  },

  async getEmployee(businessId: number, id: number) {
    return this.getEmployeeById(businessId, id);
  },

  /**
   * Create new employee with auto-generated code and default leave balance
   */
  async createEmployee(businessId: number, data: EmployeeInput) {
    const resolvedName = (data.name || `${data.first_name || ''} ${data.last_name || ''}`).trim();
    if (!resolvedName) {
      throw new Error('Employee name is required.');
    }
    if (!data.designation || !data.designation.trim()) {
      throw new Error('Employee designation is required.');
    }

    // Check email uniqueness within this business if email provided
    if (data.email && data.email.trim()) {
      const emailTrimmed = data.email.trim().toLowerCase();
      const existingEmail = await db.queryOne(
        'SELECT id FROM employees WHERE business_id = ? AND LOWER(email) = ?',
        [businessId, emailTrimmed]
      );
      if (existingEmail) {
        throw new Error(`An employee with email '${data.email.trim()}' already exists in your business.`);
      }
    }

    // Verify or default store_id
    let targetStoreId: number | null = data.store_id ? Number(data.store_id) : null;
    if (targetStoreId) {
      const storeCheck = await db.queryOne('SELECT id FROM stores WHERE business_id = ? AND id = ?', [businessId, targetStoreId]);
      if (!storeCheck) targetStoreId = null;
    }
    if (!targetStoreId) {
      const primaryStore = await db.queryOne('SELECT id FROM stores WHERE business_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1', [businessId]);
      targetStoreId = primaryStore ? Number(primaryStore.id) : null;
    }

    // Verify or default department_id
    let targetDeptId: number | null = data.department_id ? Number(data.department_id) : null;
    if (targetDeptId) {
      const deptCheck = await db.queryOne('SELECT id FROM departments WHERE business_id = ? AND id = ?', [businessId, targetDeptId]);
      if (!deptCheck) targetDeptId = null;
    }
    if (!targetDeptId) {
      const depts = await this.getDepartments(businessId);
      targetDeptId = depts.length > 0 ? Number(depts[0].id) : null;
    }

    // Verify or default shift_id
    let targetShiftId: number | null = data.shift_id ? Number(data.shift_id) : null;
    if (targetShiftId) {
      const shiftCheck = await db.queryOne('SELECT id FROM shifts WHERE business_id = ? AND id = ?', [businessId, targetShiftId]);
      if (!shiftCheck) targetShiftId = null;
    }
    if (!targetShiftId) {
      const shifts = await this.getShifts(businessId);
      targetShiftId = shifts.length > 0 ? Number(shifts[0].id) : null;
    }

    // Handle employee code: validate if provided, otherwise auto-generate collision-safe EMP-YYYY-XXX
    const year = new Date().getFullYear();
    let employeeCode = (data.employee_code || '').trim();
    if (!employeeCode) {
      const countRes = await db.queryOne('SELECT count(*) as cnt FROM employees WHERE business_id = ?', [businessId]);
      let seq = Number(countRes?.cnt || 0) + 1;
      while (true) {
        const candidate = `EMP-${year}-${String(seq).padStart(3, '0')}`;
        const exists = await db.queryOne('SELECT id FROM employees WHERE business_id = ? AND employee_code = ?', [businessId, candidate]);
        if (!exists) {
          employeeCode = candidate;
          break;
        }
        seq++;
      }
    } else {
      const exists = await db.queryOne('SELECT id FROM employees WHERE business_id = ? AND employee_code = ?', [businessId, employeeCode]);
      if (exists) {
        throw new Error(`Employee ID '${employeeCode}' already exists in your business.`);
      }
    }

    const resolvedSalary = data.basic_salary ?? data.base_salary ?? 0;

    const res = await db.execute(`
      INSERT INTO employees (
        business_id, store_id, department_id, shift_id, employee_code, name, email, phone,
        address, city, state, pincode, designation, joining_date, employment_status,
        basic_salary, hra, allowances, deductions, emergency_contact_name,
        emergency_contact_phone, emergency_contact_relation, payment_method, bank_name,
        bank_account_number, bank_ifsc, pan_number, notes, performance_rating, documents_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      businessId,
      targetStoreId,
      targetDeptId,
      targetShiftId,
      employeeCode,
      resolvedName,
      data.email?.trim().toLowerCase() || null,
      data.phone?.trim() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      data.designation.trim(),
      data.joining_date || new Date().toISOString().slice(0, 10),
      data.employment_status || 'active',
      Math.max(0, Number(resolvedSalary) || 0),
      Math.max(0, Number(data.hra) || 0),
      Math.max(0, Number(data.allowances) || 0),
      Math.max(0, Number(data.deductions) || 0),
      data.emergency_contact_name?.trim() || null,
      data.emergency_contact_phone?.trim() || null,
      data.emergency_contact_relation?.trim() || null,
      data.payment_method || 'bank_transfer',
      data.bank_name?.trim() || null,
      data.bank_account_number?.trim() || null,
      data.bank_ifsc?.trim() || null,
      data.pan_number?.trim() || null,
      data.notes?.trim() || null,
      Number(data.performance_rating) || 4.0,
      data.documents_json || null
    ]);

    const newEmpId = Number(res.lastInsertId);

    // Initialize annual leave balances for employee
    await db.execute(`
      INSERT INTO leave_balances (
        business_id, employee_id, year, casual_total, casual_used, sick_total, sick_used, paid_total, paid_used, unpaid_used
      ) VALUES (?, ?, ?, 12.0, 0.0, 12.0, 0.0, 15.0, 0.0, 0.0)
    `, [businessId, newEmpId, year]);

    await auditService.log({
      businessId,
      storeId: targetStoreId || undefined,
      action: 'EMPLOYEE_CREATED',
      entityType: 'employee',
      entityId: newEmpId,
      details: { name: resolvedName, employeeCode, designation: data.designation }
    });

    return this.getEmployeeById(businessId, newEmpId);
  },

  /**
   * Update employee details
   */
  async updateEmployee(businessId: number, id: number, data: Partial<EmployeeInput>) {
    const current = await db.queryOne('SELECT * FROM employees WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!current) throw new Error('Employee not found.');

    if (data.email && data.email.trim()) {
      const emailTrimmed = data.email.trim().toLowerCase();
      const existingEmail = await db.queryOne(
        'SELECT id FROM employees WHERE business_id = ? AND LOWER(email) = ? AND id != ?',
        [businessId, emailTrimmed, id]
      );
      if (existingEmail) {
        throw new Error(`An employee with email '${data.email.trim()}' already exists in your business.`);
      }
    }

    await db.execute(`
      UPDATE employees SET
        store_id = ?,
        department_id = ?,
        shift_id = ?,
        name = ?,
        email = ?,
        phone = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        designation = ?,
        joining_date = ?,
        employment_status = ?,
        basic_salary = ?,
        hra = ?,
        allowances = ?,
        deductions = ?,
        emergency_contact_name = ?,
        emergency_contact_phone = ?,
        emergency_contact_relation = ?,
        payment_method = ?,
        bank_name = ?,
        bank_account_number = ?,
        bank_ifsc = ?,
        pan_number = ?,
        notes = ?,
        performance_rating = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ? AND id = ?
    `, [
      data.store_id !== undefined ? (data.store_id ? Number(data.store_id) : null) : current.store_id,
      data.department_id !== undefined ? (data.department_id ? Number(data.department_id) : null) : current.department_id,
      data.shift_id !== undefined ? (data.shift_id ? Number(data.shift_id) : null) : current.shift_id,
      data.name ? data.name.trim() : (data.first_name ? `${data.first_name.trim()} ${data.last_name?.trim() || ''}`.trim() : current.name),
      data.email !== undefined ? data.email?.trim().toLowerCase() || null : current.email,
      data.phone !== undefined ? data.phone?.trim() || null : current.phone,
      data.address !== undefined ? data.address?.trim() || null : current.address,
      data.city !== undefined ? data.city?.trim() || null : current.city,
      data.state !== undefined ? data.state?.trim() || null : current.state,
      data.pincode !== undefined ? data.pincode?.trim() || null : current.pincode,
      data.designation ? data.designation.trim() : current.designation,
      data.joining_date || current.joining_date,
      data.employment_status || current.employment_status,
      data.basic_salary !== undefined ? Math.max(0, Number(data.basic_salary)) : (data.base_salary !== undefined ? Math.max(0, Number(data.base_salary)) : current.basic_salary),
      data.hra !== undefined ? Math.max(0, Number(data.hra)) : current.hra,
      data.allowances !== undefined ? Math.max(0, Number(data.allowances)) : current.allowances,
      data.deductions !== undefined ? Math.max(0, Number(data.deductions)) : current.deductions,
      data.emergency_contact_name !== undefined ? data.emergency_contact_name?.trim() || null : current.emergency_contact_name,
      data.emergency_contact_phone !== undefined ? data.emergency_contact_phone?.trim() || null : current.emergency_contact_phone,
      data.emergency_contact_relation !== undefined ? data.emergency_contact_relation?.trim() || null : current.emergency_contact_relation,
      data.payment_method !== undefined ? data.payment_method : (current.payment_method || 'bank_transfer'),
      data.bank_name !== undefined ? data.bank_name?.trim() || null : current.bank_name,
      data.bank_account_number !== undefined ? data.bank_account_number?.trim() || null : current.bank_account_number,
      data.bank_ifsc !== undefined ? data.bank_ifsc?.trim() || null : current.bank_ifsc,
      data.pan_number !== undefined ? data.pan_number?.trim() || null : current.pan_number,
      data.notes !== undefined ? data.notes?.trim() || null : current.notes,
      data.performance_rating !== undefined ? Number(data.performance_rating) : current.performance_rating,
      businessId,
      id
    ]);

    await auditService.log({
      businessId,
      storeId: current.store_id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'employee',
      entityId: id,
      details: { id, updatedFields: Object.keys(data) }
    });

    return this.getEmployeeById(businessId, id);
  },

  /**
   * Delete or terminate employee
   */
  async deleteEmployee(businessId: number, id: number) {
    const emp = await db.queryOne('SELECT * FROM employees WHERE business_id = ? AND id = ?', [businessId, id]);
    if (!emp) throw new Error('Employee not found.');

    // Check if employee has attendance or payroll history
    const attCount = await db.queryOne('SELECT count(*) as cnt FROM attendance WHERE employee_id = ?', [id]);
    const payCount = await db.queryOne('SELECT count(*) as cnt FROM payroll_items WHERE employee_id = ?', [id]);

    if (Number(attCount?.cnt || 0) > 0 || Number(payCount?.cnt || 0) > 0) {
      // Soft delete to protect financial and historical integrity
      await db.execute("UPDATE employees SET employment_status = 'terminated', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
      return { success: true, message: 'Employee has attendance/payroll history; status updated to Terminated.' };
    }

    await db.execute('DELETE FROM leave_balances WHERE employee_id = ?', [id]);
    await db.execute('DELETE FROM employees WHERE business_id = ? AND id = ?', [businessId, id]);

    await auditService.log({
      businessId,
      storeId: emp.store_id,
      action: 'EMPLOYEE_DELETED',
      entityType: 'employee',
      entityId: id,
      details: { name: emp.name, code: emp.employee_code }
    });

    return { success: true, message: 'Employee deleted successfully.' };
  },

  /**
   * Aggregate statistics for workforce dashboard
   */
  async getEmployeeStats(businessId: number, storeId?: number) {
    let baseWhere = 'WHERE business_id = ?';
    const params: any[] = [businessId];
    if (storeId) {
      baseWhere += ' AND store_id = ?';
      params.push(storeId);
    }

    const totalEmps = await db.queryOne(`SELECT COUNT(*) as cnt FROM employees ${baseWhere}`, params);
    const activeEmps = await db.queryOne(`SELECT COUNT(*) as cnt FROM employees ${baseWhere} AND employment_status = 'active'`, params);
    const probationEmps = await db.queryOne(`SELECT COUNT(*) as cnt FROM employees ${baseWhere} AND employment_status = 'probation'`, params);
    const payrollLiability = await db.queryOne(`
      SELECT SUM(basic_salary + COALESCE(hra,0) + COALESCE(allowances,0) - COALESCE(deductions,0)) as total
      FROM employees ${baseWhere} AND employment_status = 'active'
    `, params);

    const depts = await db.query(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d
      JOIN employees e ON e.department_id = d.id AND e.employment_status = 'active'
      ${baseWhere.replace('WHERE', 'WHERE e.')}
      GROUP BY d.id, d.name
    `, params);

    const totalCount = Number(totalEmps?.cnt || 0);
    const activeCount = Number(activeEmps?.cnt || 0);
    const probationCount = Number(probationEmps?.cnt || 0);
    const payrollTotal = Number(payrollLiability?.total || 0);

    return {
      totalEmployees: totalCount,
      activeEmployees: activeCount,
      probationEmployees: probationCount,
      monthlyPayrollLiability: payrollTotal,
      // Snake_case aliases for frontend metrics binding
      total_employees: totalCount,
      active_employees: activeCount,
      probation_employees: probationCount,
      monthly_payroll_estimate: payrollTotal,
      departmentDistribution: depts.map(d => ({ name: d.name, count: Number(d.count) }))
    };
  }
};
