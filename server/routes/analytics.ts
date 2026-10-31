import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.ts';

const router = Router();

router.get('/summary', (req, res) => {
  try {
    const summary = analyticsService.getExecutiveSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/timeline', (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const timeline = analyticsService.getRevenueTimeline(days);
    res.json(timeline);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-products', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const products = analyticsService.getTopSellingProducts(limit);
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = analyticsService.getCategoryPerformance();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/top-customers', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const customers = analyticsService.getTopCustomers(limit);
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report', (req, res) => {
  try {
    const report = analyticsService.generateExecutiveReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
