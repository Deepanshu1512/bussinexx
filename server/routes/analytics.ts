import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const summary = await analyticsService.getExecutiveSummary(businessId);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/timeline', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const days = Number(req.query.days) || 30;
    const timeline = await analyticsService.getRevenueTimeline(businessId, days);
    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-products', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const limit = Number(req.query.limit) || 8;
    const products = await analyticsService.getTopSellingProducts(businessId, limit);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/categories', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const categories = await analyticsService.getCategoryPerformance(businessId);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-customers', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const limit = Number(req.query.limit) || 8;
    const customers = await analyticsService.getTopCustomers(businessId, limit);
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const report = await analyticsService.generateExecutiveReport(businessId);
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
