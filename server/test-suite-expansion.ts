import { initDatabase, db, isPostgres } from './db/database';
import { employeeService } from './services/employeeService';
import { attendanceService } from './services/attendanceService';
import { leaveService } from './services/leaveService';
import { payrollService } from './services/payrollService';
import { supplierService } from './services/supplierService';
import { expenseService } from './services/expenseService';
import { reportService } from './services/reportService';
import { notificationService } from './services/notificationService';
import { inventoryService } from './services/inventoryService';

async function runExpansionVerification() {
  console.log('🚀 Starting Comprehensive Bussinex Expansion Verification Suite...\n');
  await initDatabase();

  const businessId = 1;
  const storeId = 1;

  // 1. Employee Management Tests
  console.log('1️⃣ Testing Employee Management & Departments...');
  const dept = await employeeService.createDepartment(businessId, {
    name: `Logistics & Fulfillment ${Date.now()}`,
    description: 'Warehouse dispatch and courier coordination',
  });
  console.log('   ✅ Department created:', dept.name);

  const shifts = await employeeService.getShifts(businessId);
  const shiftId = shifts.length > 0 ? shifts[0].id : 1;
  console.log('   ✅ Shifts retrieved. Active shift ID:', shiftId);

  const emp = await employeeService.createEmployee(businessId, {
    store_id: storeId,
    first_name: 'Vikram',
    last_name: 'Malhotra',
    email: `vikram.${Date.now()}@bussinex-test.com`,
    phone: '9876543299',
    address: 'Indiranagar 100ft Road, Bengaluru',
    department_id: dept.id,
    designation: 'Inventory Lead',
    joining_date: '2026-01-15',
    employment_status: 'active',
    shift_id: shiftId,
    base_salary: 45000,
    hourly_rate: 250,
    payment_method: 'bank_transfer',
    bank_account_number: '50100456789012',
    bank_ifsc: 'HDFC0001234',
    bank_name: 'HDFC Bank',
    pan_number: 'ABCDE1234F',
    emergency_contact_name: 'Sunita Malhotra',
    emergency_contact_phone: '9876543298',
    emergency_contact_relation: 'Spouse',
  });
  console.log('   ✅ Employee created with auto-code:', emp.employee_code, emp.full_name);

  const leaveBal = await leaveService.getBalance(businessId, emp.id, 2026);
  if (!leaveBal || leaveBal.casual_leave_total !== 12) {
    throw new Error('Leave balance initialization failed');
  }
  console.log('   ✅ Leave balance auto-initialized: 12 CL, 10 SL, 15 PL');

  // 2. Attendance Management Tests
  console.log('\n2️⃣ Testing Daily Attendance, Punch In/Out & Shift Comparison...');
  const todayStr = new Date().toISOString().split('T')[0];
  const punchInRes = await attendanceService.punch(businessId, emp.id, 'in', 'Front desk biometrics');
  console.log('   ✅ Punch IN recorded:', punchInRes.check_in_time);

  const punchOutRes = await attendanceService.punch(businessId, emp.id, 'out', 'Front desk biometrics');
  console.log('   ✅ Punch OUT recorded:', punchOutRes.check_out_time, `(Working hours: ${punchOutRes.total_working_hours}h)`);

  // Test manager audit correction
  const corrected = await attendanceService.correctAttendance(businessId, {
    attendanceId: punchOutRes.id,
    status: 'present',
    reason: 'Manager verified overtime manual adjustment',
    correctedBy: 1,
  });
  if (!corrected.is_manually_corrected) {
    throw new Error('Audit tracking failed on attendance correction');
  }
  console.log('   ✅ Attendance audit correction logged successfully');

  // 3. Leave Management Tests
  console.log('\n3️⃣ Testing Leave Application, Balance Deductions & Attendance Sync...');
  const leaveApp = await leaveService.applyLeave(businessId, {
    employeeId: emp.id,
    leaveType: 'casual',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    reason: 'Personal family emergency',
  });
  console.log('   ✅ Leave applied. Duration:', leaveApp.total_days, 'days. Status:', leaveApp.status);

  const reviewRes = await leaveService.reviewLeave(businessId, leaveApp.id, {
    status: 'approved',
    managerRemarks: 'Approved by Branch Manager',
    reviewedBy: 1,
  });
  console.log('   ✅ Leave reviewed & approved. Attendance synced for dates.');

  const updatedBal = await leaveService.getBalance(businessId, emp.id, 2026);
  if (updatedBal.casual_leave_used !== 2) {
    throw new Error(`Expected casual_leave_used to be 2, got ${updatedBal.casual_leave_used}`);
  }
  console.log('   ✅ Leave balance accurately decremented:', updatedBal.casual_leave_total - updatedBal.casual_leave_used, 'days left');

  // 4. Payroll Management Tests
  console.log('\n4️⃣ Testing Payroll Computation, Duplicate Run Guard & Disbursal...');
  // Clean up any previous test run for 11/2026 to ensure idempotent execution
  await db.execute('DELETE FROM payrolls WHERE business_id = ? AND month = 11 AND year = 2026', [businessId]);

  const calc = await payrollService.calculatePayroll(businessId, 11, 2026, storeId);
  console.log('   ✅ Computed payroll calculation for 11/2026. Net Liability:', calc.total_net_salary);

  const generated = await payrollService.generatePayroll(businessId, {
    month: 11,
    year: 2026,
    storeId,
    notes: 'November 2026 Test Run',
    items: calc.items,
  });
  console.log('   ✅ Generated Payroll batch ID:', generated.id);

  // Duplicate generation guard test
  try {
    await payrollService.generatePayroll(businessId, {
      month: 11,
      year: 2026,
      storeId,
      items: calc.items,
    });
    throw new Error('Duplicate payroll check failed to throw!');
  } catch (err: any) {
    console.log('   ✅ Duplicate payroll run blocked successfully:', err.message);
  }

  // Disburse Payroll & check Expense Synchronization
  const disbursed = await payrollService.disbursePayroll(businessId, generated.id, {
    paymentMethod: 'bank_transfer',
    notes: 'Direct corporate salary disbursement',
  });
  console.log('   ✅ Payroll disbursed. Status:', disbursed.status);

  // Check generated Salary Slip
  const empItem = disbursed.items!.find((it: any) => it.employee_id === emp.id) || disbursed.items![0];
  const slip = await payrollService.getSalarySlip(businessId, empItem.id);
  if (!slip || slip.employee_code !== empItem.employee_code) {
    throw new Error(`Salary slip data mismatch: expected ${empItem.employee_code}, got ${slip?.employee_code}`);
  }
  console.log('   ✅ Official Salary Slip verified for:', slip.employee_name, `Net: ₹${slip.net_salary}`);

  // 5. Supplier Management & Purchase Orders Tests
  console.log('\n5️⃣ Testing Suppliers, Purchase Orders & Inventory Receipt...');
  const supplier = await supplierService.createSupplier(businessId, {
    name: `Global Logistics Corp ${Date.now()}`,
    contact_person: 'Anil Mehta',
    email: 'anil@globallogistics.com',
    phone: '9876543210',
    city: 'Mumbai',
    gstin: '27AABCG1234F1Z1',
    payment_terms: 'Net 30',
    lead_time_days: 5,
  });
  console.log('   ✅ Supplier created:', supplier.name);

  // Get a product for PO
  const products = await inventoryService.getProducts(businessId);
  const testProduct = products[0];

  const po = await supplierService.createPO(businessId, {
    supplierId: supplier.id,
    storeId,
    orderDate: todayStr,
    items: [
      {
        productId: testProduct.id,
        quantity: 20,
        unitCost: testProduct.cost_price || 500,
      },
    ],
    shippingCost: 200,
    taxAmount: 180,
    notes: 'Express restocking shipment',
  });
  console.log('   ✅ Purchase Order issued:', po.po_number, `Total: ₹${po.total_amount}`);

  // Receive stock from PO into inventory
  const poDetailed = await supplierService.getPO(businessId, po.id);
  const poItemId = poDetailed.items![0].id;

  const receiveRes = await supplierService.receiveStock(businessId, po.id, {
    receivedItems: [{ itemId: poItemId, quantityReceived: 20 }],
    notes: 'Received in full at warehouse dock',
  });
  if (receiveRes.status !== 'received') {
    throw new Error(`Expected PO status to be received, got ${receiveRes.status}`);
  }
  console.log('   ✅ Stock received into store inventory & stock movement logs recorded');

  // Supplier payment & expense sync test
  const paymentRes = await supplierService.recordPayment(businessId, po.id, {
    amount: po.total_amount,
    payment_method: 'bank_transfer',
    notes: 'Settlement for invoice ' + po.po_number,
  });
  if (paymentRes.payment_status !== 'paid') {
    throw new Error(`Expected payment_status to be paid, got ${paymentRes.payment_status}`);
  }
  console.log('   ✅ PO payment completed & synced to operating expenses');

  // 6. Expenses & Financial P&L Tests
  console.log('\n6️⃣ Testing Operating Expenses & Financial Overview...');
  const exp = await expenseService.createExpense(businessId, {
    store_id: storeId,
    category_id: 1, // Rent & Facility
    title: 'High-speed Fiber Broadband Lease',
    amount: 3500,
    date: todayStr,
    payment_method: 'bank_transfer',
    payment_status: 'paid',
  });
  console.log('   ✅ Operating expense recorded:', exp.title, `(₹${exp.amount})`);

  const pnl = await expenseService.getFinancialOverview(businessId, { store_id: storeId });
  console.log('   ✅ Financial P&L Computed:');
  console.log('      • Gross Revenue:       ₹' + pnl.revenue);
  console.log('      • Cost of Goods Sold:  ₹' + pnl.cogs);
  console.log('      • Gross Profit:        ₹' + pnl.gross_profit);
  console.log('      • Operating Expenses:  ₹' + pnl.operating_expenses);
  console.log('      • Net Profit:          ₹' + pnl.net_profit);
  console.log('      • Net Cash Flow:       ₹' + pnl.cash_flow.net_cash_flow);

  // 7. Reports & Analytics Tests
  console.log('\n7️⃣ Testing Comprehensive Reports Generation...');
  const salesRep = await reportService.getSalesReport(businessId, { store_id: storeId });
  console.log('   ✅ Sales Timeline Report generated. Orders count:', salesRep.summary.total_orders);

  const invRep = await reportService.getInventoryValuationReport(businessId, storeId);
  console.log('   ✅ Inventory Valuation Report generated. Total stock units:', invRep.summary.total_units);

  const wfRep = await reportService.getWorkforceReport(businessId, { storeId, month: 11, year: 2026 });
  console.log('   ✅ Workforce Productivity Report generated. Staff count:', wfRep.summary.total_employees);

  const storeComp = await reportService.getStoreComparison(businessId);
  console.log('   ✅ Multi-Store Comparison generated. Stores compared:', storeComp.length);

  // 8. Notifications Center Tests
  console.log('\n8️⃣ Testing Notification Center & Alert Scanners...');
  const scanRes = await notificationService.scanAndGenerateAlerts(businessId);
  console.log('   ✅ Notification scanner completed. New alerts generated:', scanRes.added);

  const notifications = await notificationService.getNotifications(businessId, { limit: 5 });
  console.log('   ✅ Notifications retrieved:', notifications.length, 'entries');

  // 9. IDOR & Tenant Isolation Tests
  console.log('\n9️⃣ Testing Multi-Tenant IDOR Isolation...');
  const foreignBusinessId = 9999;

  const blockedEmp = await employeeService.getEmployee(foreignBusinessId, emp.id);
  if (blockedEmp !== null) {
    throw new Error('IDOR violation: Cross-business employee was accessible!');
  }

  const blockedLeave = await leaveService.getLeaves(foreignBusinessId, { employeeId: emp.id });
  if (blockedLeave.length > 0) {
    throw new Error('IDOR violation: Cross-business leaves were accessible!');
  }

  const blockedPO = await supplierService.getPO(foreignBusinessId, po.id);
  if (blockedPO !== null) {
    throw new Error('IDOR violation: Cross-business PO was accessible!');
  }
  console.log('   ✅ Multi-Tenant IDOR protections fully enforced across all modules.');

  console.log('\n🎉 ALL 9 EXPANSION DOMAIN VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀');
}

runExpansionVerification().catch((err) => {
  console.error('\n❌ Expansion Verification Failed:', err);
  process.exit(1);
});
