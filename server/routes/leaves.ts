import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { leaveService } from '../services/leaveService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/leaves — List leave applications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { employee_id, store_id, status, start_date, end_date, limit, offset } = req.query;

    const applications = await leaveService.getLeaveApplications(businessId, {
      employee_id: employee_id ? Number(employee_id) : undefined,
      store_id: store_id ? Number(store_id) : undefined,
      status: status ? String(status) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });

    res.json(applications);
  } catch (error: any) {
    console.error('Fetch leaves error:', error);
    res.status(500).json({ error: 'Failed to retrieve leave applications.' });
  }
});

// GET /api/leaves/balances/:employeeId — Get leave balance
router.get('/balances/:employeeId', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const balances = await leaveService.getLeaveBalances(businessId, Number(req.params.employeeId), year);
    res.json(balances);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve leave balances.' });
  }
});

// POST /api/leaves/apply — Submit leave application
router.post('/apply', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const application = await leaveService.applyLeave(businessId, req.body);
    res.status(201).json({ success: true, message: 'Leave application submitted.', leave: application });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/leaves/:id/review — Manager approval/rejection
router.put('/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const reviewerUserId = req.user!.id;
    const result = await leaveService.reviewLeave(businessId, Number(req.params.id), reviewerUserId, req.body);
    res.json({ success: true, message: `Leave application ${req.body.status}.`, leave: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
