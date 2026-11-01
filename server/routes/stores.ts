import { Router, Response } from 'express';
import { storeService } from '../services/storeService.ts';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/stores — List all stores
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const stores = await storeService.getStores(businessId);
    res.json(stores);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unable to fetch stores.' });
  }
});

// GET /api/stores/transfers — Transfer logs
router.get('/transfers', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const transfers = await storeService.getTransfers(businessId, { storeId, limit });
    res.json(transfers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unable to fetch stock transfers.' });
  }
});

// GET /api/stores/:id — Single store details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = Number(req.params.id);
    const store = await storeService.getStoreById(businessId, storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found.' });
    }
    res.json(store);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Unable to fetch store details.' });
  }
});

// POST /api/stores — Create a new store (Admin/Manager only)
router.post('/', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const store = await storeService.createStore(businessId, req.body);
    res.status(201).json(store);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to create store.' });
  }
});

// PUT /api/stores/:id — Update a store
router.put('/:id', requireRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = Number(req.params.id);
    const store = await storeService.updateStore(businessId, storeId, req.body);
    res.json(store);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to update store.' });
  }
});

// DELETE /api/stores/:id — Delete or deactivate a store
router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = Number(req.params.id);
    const result = await storeService.deleteStore(businessId, storeId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to delete store.' });
  }
});

// POST /api/stores/transfers — Transfer stock between stores
router.post('/transfers', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { fromStoreId, toStoreId, productId, quantity, notes } = req.body;

    if (!fromStoreId || !toStoreId || !productId || !quantity) {
      return res.status(400).json({ error: 'Source store, destination store, product, and quantity are required.' });
    }

    const result = await storeService.transferStock(businessId, {
      fromStoreId: Number(fromStoreId),
      toStoreId: Number(toStoreId),
      productId: Number(productId),
      quantity: Number(quantity),
      transferredBy: req.user!.id,
      notes: notes ? String(notes).trim() : undefined
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Stock transfer failed.' });
  }
});

export default router;
