import { Router } from 'express';
import { orderService } from '../services/orderService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET orders list
router.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { search, status, customer_id, limit, offset } = req.query;
    const orders = await orderService.getOrders(businessId, {
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      customer_id: customer_id ? Number(customer_id) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single order
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const order = await orderService.getOrderById(businessId, Number(req.params.id));
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create order
router.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const order = await orderService.createOrder(businessId, req.body);
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update order status
router.put('/:id/status', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { status } = req.body;
    if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const order = await orderService.updateOrderStatus(businessId, Number(req.params.id), status);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
