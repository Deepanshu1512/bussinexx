import { db } from '../db/database.ts';
import { auditService } from './auditService.ts';

export interface GeneratePayrollInput {
  store_id?: number | null;
  month: number; // 1-12
  year: number;  // e.g. 2026
  notes?: string;
}

export const payrollService = {
  /**
   * List monthly payroll runs
   */
  async getPayrolls(businessId: number, filters: {
    store_id?: number;
    year?: number;
    month?: number;
    status?: string;
  } = {}) {
    let query = `
      SELECT 
        p.*,
        s.name as store_name,
        s.code as store_code,
        u.name as generated_by_name
      FROM payrolls p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN users u ON p.generated_by = u.id
      WHERE p.business_id = ?
    `;
    const params: any[] = [businessId];

    if (filters.store_id) {
      query += ' AND p.store_id = ?';
      params.push(filters.store_id);
    }

    if (filters.year) {
      query += ' AND p.year = ?';
      params.push(filters.year);
    }

    if (filters.month) {
      query += ' AND p.month = ?';
      params.push(filters.month);
    }

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY p.year DESC, p.month DESC, p.id DESC';

    const rows = await db.query(query, params);
    return rows.map(r => ({
      ...r,
      total_amount: Number(r.total_amount || 0),
      total_employees: Number(r.total_employees || 0)
    }));
  },

  /**
   * Retrieve a payroll with all employee items
   */
  async getPayrollById(businessId: number, id: number) {
    const payroll = await db.queryOne(`
      SELECT 
        p.*,
        s.name as store_name,
        s.code as store_code,
        u.name as generated_by_name
      FROM payrolls p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN users u ON p.generated_by = u.id
      WHERE p.business_id = ? AND p.id = ?
    `, [businessId, id]);

    if (!payroll) return null;

    const items = await db.query(`
      SELECT 
        pi.*,
        e.name as employee_name,
        e.employee_code,
        e.designation,
        e.email as employee_email,
        e.phone as employee_phone,
        d.name as department_name,
        s.name as store_name
      FROM payroll_items pi
      JOIN employees e ON pi.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE pi.payroll_id = ?
      ORDER BY e.name ASC
    `, [id]);

    return {
      ...payroll,
      total_amount: Number(payroll.total_amount || 0),
      total_net_salary: Number(payroll.total_amount || 0),
      total_gross_salary: Number(payroll.total_amount || 0),
      total_deductions: 0,
      total_employees: Number(payroll.total_employees || 0),
      employee_count: Number(payroll.total_employees || 0),
      items: items.map((it: any) => ({
        ...it,
        employee_name: it.employee_name,
        employee_code: it.employee_code,
        basic_salary: Number(it.basic_salary || 0),
        base_salary: Number(it.basic_salary || 0),
        hra: Number(it.hra || 0),
        allowances: Number(it.allowances || 0),
        overtime_pay: Number(it.overtime_pay || 0),
        bonus: Number(it.bonuses || 0),
        bonuses: Number(it.bonuses || 0),
        deductions: Number(it.deductions || 0),
        advances: Number(it.advances || 0),
        advance_deduction: Number(it.advances || 0),
        net_salary: Number(it.net_salary || 0),
        working_days: Number(it.working_days || 30),
        present_days: Number(it.present_days || 0),
        leave_days: Number(it.leave_days || 0)
      }))
    };
  },

  /**
   * Calculate preview for monthly payroll
   */
  async calculatePayroll(businessId: number, month: number, year: number, storeId?: number) {
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

    let empQuery = "SELECT * FROM employees WHERE business_id = ? AND employment_status = 'active'";
    const empParams: any[] = [businessId];
    if (storeId) {
      empQuery += ' AND store_id = ?';
      empParams.push(storeId);
    }
    const employees = await db.query(empQuery, empParams);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const items = [];

    for (const emp of employees) {
      const basic = Number(emp.basic_salary || 0);
      const hra = Number(emp.hra || 0);
      const allowances = Number(emp.allowances || 0);
      const deductions = Number(emp.deductions || 0);

      const attendanceLogs = await db.query(`
        SELECT status, working_hours, overtime_hours, late_mins
        FROM attendance
        WHERE employee_id = ? AND date BETWEEN ? AND ?
      `, [emp.id, startDateStr, endDateStr]);

      let presentDays = 0;
      let halfDays = 0;
      let onLeaveDays = 0;
      let totalOvertimeHours = 0;

      for (const log of attendanceLogs) {
        if (log.status === 'present') presentDays += 1;
        else if (log.status === 'half_day') halfDays += 1;
        else if (log.status === 'on_leave') onLeaveDays += 1;
        totalOvertimeHours += Number(log.overtime_hours || 0);
      }

      if (attendanceLogs.length === 0) {
        presentDays = totalDaysInMonth - 4;
      }

      const payableDays = presentDays + (halfDays * 0.5) + onLeaveDays;
      const dailyRate = totalDaysInMonth > 0 ? (basic / totalDaysInMonth) : 0;
      const earnedBasic = Number((dailyRate * Math.min(totalDaysInMonth, payableDays)).toFixed(2));
      const hourlyRate = dailyRate / 9;
      const overtimePay = Number((hourlyRate * 1.5 * totalOvertimeHours).toFixed(2));
      const netSalary = Math.max(0, Number((earnedBasic + hra + allowances + overtimePay - deductions).toFixed(2)));

      totalGross += (earnedBasic + hra + allowances + overtimePay);
      totalDeductions += deductions;
      totalNet += netSalary;

      items.push({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.name,
        designation: emp.designation,
        basic_salary: basic,
        base_salary: basic,
        present_days: presentDays,
        paid_leave_days: onLeaveDays,
        unpaid_leave_days: 0,
        absent_days: Math.max(0, totalDaysInMonth - (presentDays + halfDays + onLeaveDays)),
        overtime_hours: totalOvertimeHours,
        overtime_pay: overtimePay,
        bonus: 0,
        allowances,
        deductions,
        advance_deduction: 0,
        gross_earnings: earnedBasic + hra + allowances + overtimePay,
        net_salary: netSalary
      });
    }

    return {
      month,
      year,
      storeId,
      total_gross_salary: totalGross,
      total_deductions: totalDeductions,
      total_net_salary: totalNet,
      employee_count: employees.length,
      items
    };
  },

  /**
   * Generate monthly payroll automatically calculating attendance, overtime & deductions
   */
  async generatePayroll(businessId: number, arg2: any, arg3?: any) {
    let generatedByUserId = 1;
    let data: any;

    if (typeof arg2 === 'number') {
      generatedByUserId = arg2;
      data = arg3 || {};
    } else {
      data = arg2 || {};
      generatedByUserId = data.userId || 1;
    }

    const month = Number(data.month);
    const year = Number(data.year);
    const store_id = data.store_id || data.storeId || null;
    const notes = data.notes;
    if (!month || !year || month < 1 || month > 12) {
      throw new Error('Valid month (1-12) and year are required.');
    }

    // Guard: Prevent duplicate payroll generation for the same store & period!
    const existing = await db.queryOne(
      'SELECT id, status FROM payrolls WHERE business_id = ? AND store_id IS ? AND month = ? AND year = ?',
      [businessId, store_id || null, month, year]
    );

    if (existing) {
      throw new Error(`Payroll for ${month}/${year} has already been generated (Run ID: #${existing.id}, Status: ${existing.status}).`);
    }

    // Determine calendar days in target month
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

    // Fetch active employees
    let empQuery = "SELECT * FROM employees WHERE business_id = ? AND employment_status = 'active'";
    const empParams: any[] = [businessId];
    if (store_id) {
      empQuery += ' AND store_id = ?';
      empParams.push(store_id);
    }
    const employees = await db.query(empQuery, empParams);

    if (employees.length === 0) {
      throw new Error('No active employees found to generate payroll for this store/business.');
    }

    // Create payroll header record
    const payrollRes = await db.execute(`
      INSERT INTO payrolls (
        business_id, store_id, month, year, total_amount, total_employees, status, generated_by, notes
      ) VALUES (?, ?, ?, ?, 0.0, ?, 'draft', ?, ?)
    `, [
      businessId,
      store_id || null,
      month,
      year,
      employees.length,
      generatedByUserId,
      notes || `Monthly payroll for ${new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`
    ]);

    const payrollId = Number(payrollRes.lastInsertId);
    let cumulativePayrollAmount = 0;

    for (const emp of employees) {
      const basic = Number(emp.basic_salary || 0);
      const hra = Number(emp.hra || 0);
      const allowances = Number(emp.allowances || 0);
      const deductions = Number(emp.deductions || 0);

      // Query employee's attendance logs for this month
      const attendanceLogs = await db.query(`
        SELECT status, working_hours, overtime_hours, late_mins
        FROM attendance
        WHERE employee_id = ? AND date BETWEEN ? AND ?
      `, [emp.id, startDateStr, endDateStr]);

      let presentDays = 0;
      let halfDays = 0;
      let onLeaveDays = 0;
      let totalOvertimeHours = 0;

      for (const log of attendanceLogs) {
        if (log.status === 'present') presentDays += 1;
        else if (log.status === 'half_day') halfDays += 1;
        else if (log.status === 'on_leave') onLeaveDays += 1;

        totalOvertimeHours += Number(log.overtime_hours || 0);
      }

      // If no punch records exist (e.g. freshly created demo), default to standard month attendance
      if (attendanceLogs.length === 0) {
        presentDays = totalDaysInMonth - 4; // Assuming 4 weekly off days
      }

      const payableDays = presentDays + (halfDays * 0.5) + onLeaveDays;
      const dailyRate = totalDaysInMonth > 0 ? (basic / totalDaysInMonth) : 0;
      const earnedBasic = Number((dailyRate * Math.min(totalDaysInMonth, payableDays)).toFixed(2));

      // Overtime Pay = 1.5x hourly rate (based on 9hr day)
      const hourlyRate = dailyRate / 9;
      const overtimePay = Number((hourlyRate * 1.5 * totalOvertimeHours).toFixed(2));

      const netSalary = Math.max(0, Number((earnedBasic + hra + allowances + overtimePay - deductions).toFixed(2)));
      cumulativePayrollAmount += netSalary;

      const slipNumber = `SLIP-${year}${String(month).padStart(2, '0')}-${emp.employee_code}`;

      await db.execute(`
        INSERT INTO payroll_items (
          payroll_id, employee_id, basic_salary, hra, allowances, overtime_pay, bonuses,
          deductions, advances, net_salary, working_days, present_days, leave_days,
          status, slip_number
        ) VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, 0.0, ?, ?, ?, ?, 'unpaid', ?)
      `, [
        payrollId,
        emp.id,
        earnedBasic,
        hra,
        allowances,
        overtimePay,
        deductions,
        netSalary,
        totalDaysInMonth,
        presentDays + (halfDays * 0.5),
        onLeaveDays,
        slipNumber
      ]);
    }

    // Update total payroll sum
    await db.execute(
      'UPDATE payrolls SET total_amount = ? WHERE id = ?',
      [cumulativePayrollAmount, payrollId]
    );

    await auditService.log({
      businessId,
      storeId: store_id || undefined,
      userId: generatedByUserId,
      action: 'PAYROLL_GENERATED',
      entityType: 'payroll',
      entityId: payrollId,
      details: { month, year, totalAmount: cumulativePayrollAmount, employeesCount: employees.length }
    });

    return this.getPayrollById(businessId, payrollId);
  },

  /**
   * Finalize and Mark Payroll as Paid, synchronizing with Expenses module
   */
  async markPayrollPaid(businessId: number, payrollId: number, data: {
    payment_method?: string;
    paid_at?: string;
    notes?: string;
  }) {
    const payroll = await db.queryOne('SELECT * FROM payrolls WHERE business_id = ? AND id = ?', [businessId, payrollId]);
    if (!payroll) throw new Error('Payroll record not found.');

    const paidAt = data.paid_at || new Date().toISOString();
    const paymentMethod = data.payment_method || 'bank_transfer';

    await db.execute(`
      UPDATE payrolls SET
        status = 'paid',
        payment_method = ?,
        paid_at = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
    `, [paymentMethod, paidAt, data.notes || null, payrollId]);

    // Mark individual items paid
    await db.execute(`
      UPDATE payroll_items SET status = 'paid', payment_method = ?, paid_at = ? WHERE payroll_id = ?
    `, [paymentMethod, paidAt, payrollId]);

    // Synchronize to Expenses table (prevent double-counting with reference_type = 'payroll')
    const category = await db.queryOne("SELECT id FROM expense_categories WHERE business_id = ? AND name LIKE '%Salar%'", [businessId]);
    const categoryId = category ? category.id : null;

    const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    await db.execute(`
      INSERT INTO expenses (
        business_id, store_id, category_id, title, amount, date, payment_method, payment_status,
        reference_type, reference_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'payroll', ?, ?)
    `, [
      businessId,
      payroll.store_id || null,
      categoryId,
      `Employee Salaries — ${monthName}`,
      Number(payroll.total_amount),
      paidAt.slice(0, 10),
      paymentMethod,
      String(payrollId),
      `Disbursed monthly payroll #${payrollId} to ${payroll.total_employees} staff members.`
    ]);

    await auditService.log({
      businessId,
      storeId: payroll.store_id,
      action: 'PAYROLL_DISBURSED',
      entityType: 'payroll',
      entityId: payrollId,
      details: { month: payroll.month, year: payroll.year, amount: payroll.total_amount }
    });

    return this.getPayrollById(businessId, payrollId);
  },

  async disbursePayroll(businessId: number, payrollId: number, data: any) {
    return this.markPayrollPaid(businessId, payrollId, {
      payment_method: data.paymentMethod || data.payment_method,
      paid_at: data.paidAt || data.paid_at,
      notes: data.notes
    });
  },

  /**
   * Get formatted Salary Slip for PDF/Print view
   */
  async getSalarySlip(businessId: number, payrollItemId: number) {
    const item = await db.queryOne(`
      SELECT 
        pi.*,
        p.month,
        p.year,
        p.paid_at as payroll_paid_at,
        p.payment_method as payroll_payment_method,
        e.name as employee_name,
        e.employee_code,
        e.designation,
        e.joining_date,
        e.phone as employee_phone,
        e.email as employee_email,
        e.address as employee_address,
        d.name as department_name,
        s.name as store_name,
        s.address as store_address,
        b.name as business_name,
        b.currency_symbol,
        b.currency_code
      FROM payroll_items pi
      JOIN payrolls p ON pi.payroll_id = p.id
      JOIN employees e ON pi.employee_id = e.id
      JOIN businesses b ON p.business_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN stores s ON e.store_id = s.id
      WHERE p.business_id = ? AND pi.id = ?
    `, [businessId, payrollItemId]);

    if (!item) return null;

    const earnings = [
      { name: 'Basic Salary', amount: Number(item.basic_salary) },
      { name: 'House Rent Allowance (HRA)', amount: Number(item.hra) },
      { name: 'Special & Other Allowances', amount: Number(item.allowances) },
      { name: 'Overtime Earnings', amount: Number(item.overtime_pay) },
      { name: 'Bonuses & Incentives', amount: Number(item.bonuses) }
    ].filter(e => e.amount > 0);

    const deductions = [
      { name: 'Statutory / Standard Deductions', amount: Number(item.deductions) },
      { name: 'Salary Advances', amount: Number(item.advances) }
    ].filter(d => d.amount > 0);

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    return {
      payroll_item_id: item.id,
      employee_id: item.employee_id,
      employee_code: item.employee_code,
      employee_name: item.employee_name,
      designation: item.designation,
      department: item.department_name || 'General',
      joining_date: item.joining_date,
      pan_number: null,
      bank_name: null,
      bank_account_number: null,
      bank_ifsc: null,
      month: item.month,
      year: item.year,
      period_label: `${new Date(item.year, item.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
      store_name: item.store_name || 'Main Store',
      base_salary: Number(item.basic_salary),
      present_days: Number(item.present_days),
      paid_leave_days: Number(item.leave_days),
      unpaid_leave_days: 0,
      absent_days: Math.max(0, Number(item.working_days) - Number(item.present_days)),
      overtime_hours: 0,
      overtime_pay: Number(item.overtime_pay),
      bonus: Number(item.bonuses),
      allowances: Number(item.allowances),
      gross_earnings: totalEarnings,
      deductions: Number(item.deductions),
      advance_deduction: Number(item.advances),
      total_deductions: totalDeductions,
      net_salary: Number(item.net_salary),
      status: item.status,
      payment_date: item.paid_at || item.payroll_paid_at,
      payment_reference: null,
      slipNumber: item.slip_number,
      monthName: new Date(item.year, item.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      businessName: item.business_name,
      storeName: item.store_name,
      currencySymbol: item.currency_symbol || '₹',
      employee: {
        id: item.employee_id,
        name: item.employee_name,
        code: item.employee_code,
        designation: item.designation,
        department: item.department_name,
        joiningDate: item.joining_date,
        phone: item.employee_phone,
        email: item.employee_email
      },
      attendance: {
        workingDays: Number(item.working_days),
        presentDays: Number(item.present_days),
        leaveDays: Number(item.leave_days)
      },
      earnings,
      deductionsList: deductions,
      totalEarnings,
      totalDeductionsCount: totalDeductions,
      netSalary: Number(item.net_salary),
      paymentMethod: item.payment_method || item.payroll_payment_method,
      paidAt: item.paid_at || item.payroll_paid_at
    };
  }
};
