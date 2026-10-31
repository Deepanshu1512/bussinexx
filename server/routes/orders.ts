import { Router } from 'express';
import { orderService } from '../services/orderService.ts';

const router = Router();

// GET orders list
router.get('/', (req, res) => {
  try {
    const { search, status, customer_id, limit, offset } = req.query;
    const orders = orderService.getOrders({
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

// GET single order with full receipt items
router.get('/:id', (req, res) => {
  try {
    const order = orderService.getOrderById(Number(req.params.id));
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create order
router.post('/', (req, res) => {
  try {
    const order = orderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update order status
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const order = orderService.updateOrderStatus(Number(req.params.id), status);
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
