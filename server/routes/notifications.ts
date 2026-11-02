import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { notificationService } from '../services/notificationService.ts';

const router = Router();

// GET /api/notifications — List notifications
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const unread_only = req.query.unread_only === 'true';
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
router.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const count = await notificationService.getUnreadCount(businessId);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve unread notification count.' });
  }
});

// PUT /api/notifications/:id/read — Mark single read
router.put('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    await notificationService.markAsRead(businessId, Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/notifications/read-all — Mark all read
router.put('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    await notificationService.markAllAsRead(businessId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
