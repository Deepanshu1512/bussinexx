import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';
import { inventoryService } from '../services/inventoryService.ts';
import { orderService } from '../services/orderService.ts';

const router = Router();

router.get('/', (req, res) => {
  try {
    const summary = analyticsService.getExecutiveSummary();
    const revenueTimeline = analyticsService.getRevenueTimeline(14); // last 14 days
    const topProducts = analyticsService.getTopSellingProducts(5);
    const categoryStats = analyticsService.getCategoryPerformance();
    const recentOrders = orderService.getOrders({ limit: 6 });
    const inventoryHealth = inventoryService.getInventoryHealthStats();

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
