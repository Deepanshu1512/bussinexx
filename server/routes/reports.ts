import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { reportService } from '../services/reportService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/reports/sales
router.get('/sales', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, start_date, end_date } = req.query;

    const report = await reportService.getSalesReport(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined
    });

    res.json(report);
  } catch (error: any) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report.' });
  }
});

// GET /api/reports/inventory
router.get('/inventory', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const store_id = req.query.store_id ? Number(req.query.store_id) : undefined;

    const report = await reportService.getInventoryReport(businessId, { store_id });
    res.json(report);
  } catch (error: any) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Failed to generate inventory report.' });
  }
});

// GET /api/reports/employees
router.get('/employees', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, start_date, end_date } = req.query;

    const report = await reportService.getEmployeeReport(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined
    });

    res.json(report);
  } catch (error: any) {
    console.error('Employee report error:', error);
    res.status(500).json({ error: 'Failed to generate employee report.' });
  }
});

// GET /api/reports/stores — Store comparison
router.get('/stores', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const report = await reportService.getStoreComparisonReport(businessId);
    res.json(report);
  } catch (error: any) {
    console.error('Store comparison report error:', error);
    res.status(500).json({ error: 'Failed to generate store comparison report.' });
  }
});

export default router;
