import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';
import { inventoryService } from '../services/inventoryService.ts';
import { orderService } from '../services/orderService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const [summary, revenueTimeline, topProducts, categoryStats, recentOrders, inventoryHealth] = await Promise.all([
      analyticsService.getExecutiveSummary(businessId, storeId),
      analyticsService.getRevenueTimeline(businessId, 14, storeId),
      analyticsService.getTopSellingProducts(businessId, 5, storeId),
      analyticsService.getCategoryPerformance(businessId, storeId),
      orderService.getOrders(businessId, { store_id: storeId, limit: 6 }),
      inventoryService.getInventoryHealthStats(businessId, storeId),
    ]);

    res.json({
      summary,
      revenueTimeline,
      topProducts,
      categoryStats,
      recentOrders,
      inventoryHealth
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
