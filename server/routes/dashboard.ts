import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';
import { inventoryService } from '../services/inventoryService.ts';
import { orderService } from '../services/orderService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const [summary, revenueTimeline, topProducts, categoryStats, recentOrders, inventoryHealth] = await Promise.all([
      analyticsService.getExecutiveSummary(businessId),
      analyticsService.getRevenueTimeline(businessId, 14),
      analyticsService.getTopSellingProducts(businessId, 5),
      analyticsService.getCategoryPerformance(businessId),
      orderService.getOrders(businessId, { limit: 6 }),
      inventoryService.getInventoryHealthStats(businessId),
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
