import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { notificationService } from '../services/notificationService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/notifications — List notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const unread_only = req.query.unread_only === 'true' || req.query.unreadOnly === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    // Run automated scan
    await notificationService.checkAutomatedAlerts(businessId);

    const notifications = await notificationService.getNotifications(businessId, { unread_only, limit });
    const unreadCount = await notificationService.getUnreadCount(businessId);

    res.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// GET /api/notifications/unread-count — Fast badge lookup
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const count = await notificationService.getUnreadCount(businessId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve unread notification count.' });
  }
});

// POST or PUT /api/notifications/:id/read — Mark single read
const handleMarkRead = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    await notificationService.markAsRead(businessId, Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
router.put('/:id/read', handleMarkRead);
router.post('/:id/read', handleMarkRead);

// POST or PUT /api/notifications/read-all — Mark all read
const handleMarkAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    await notificationService.markAllAsRead(businessId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
router.put('/read-all', handleMarkAllRead);
router.post('/read-all', handleMarkAllRead);

// POST /api/notifications/scan — Trigger manual alerts scan
router.post('/scan', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    await notificationService.checkAutomatedAlerts(businessId);
    const unreadCount = await notificationService.getUnreadCount(businessId);
    res.json({ success: true, count: unreadCount });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to run notifications scan.' });
  }
});

export default router;
