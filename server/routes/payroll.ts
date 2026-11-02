import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { payrollService } from '../services/payrollService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/payroll — List monthly payrolls
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, year, month, status } = req.query;

    const payrolls = await payrollService.getPayrolls(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      status: status ? String(status) : undefined
    });

    res.json(payrolls);
  } catch (error: any) {
    console.error('Fetch payrolls error:', error);
    res.status(500).json({ error: 'Failed to retrieve payroll runs.' });
  }
});

// GET /api/payroll/:id — Single payroll with item breakdown
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const payroll = await payrollService.getPayrollById(businessId, Number(req.params.id));
    if (!payroll) return res.status(404).json({ error: 'Payroll record not found.' });
    res.json(payroll);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve payroll details.' });
  }
});

// POST /api/payroll/calculate — Calculate preview
router.post('/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { month, year, storeId } = req.body;
    const calc = await payrollService.calculatePayroll(businessId, Number(month), Number(year), storeId ? Number(storeId) : undefined);
    res.json(calc);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/payroll/generate — Generate monthly payroll
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const userId = req.user!.id;
    const payroll = await payrollService.generatePayroll(businessId, userId, req.body);
    res.status(201).json({ success: true, message: 'Monthly payroll generated successfully.', payroll });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/payroll/:id/disburse — Disburse payroll
router.post('/:id/disburse', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const payroll = await payrollService.disbursePayroll(businessId, Number(req.params.id), req.body);
    res.json({ success: true, message: 'Payroll disbursed and synchronized with expenses.', payroll });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/payroll/:id/pay — Mark payroll disbursed
router.put('/:id/pay', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const payroll = await payrollService.markPayrollPaid(businessId, Number(req.params.id), req.body);
    res.json({ success: true, message: 'Payroll marked as paid and synchronized with financial expenses.', payroll });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/payroll/slip/:itemId — Download/View Salary Slip
router.get('/slip/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const slip = await payrollService.getSalarySlip(businessId, Number(req.params.itemId));
    if (!slip) return res.status(404).json({ error: 'Salary slip not found.' });
    res.json(slip);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate salary slip.' });
  }
});

export default router;
