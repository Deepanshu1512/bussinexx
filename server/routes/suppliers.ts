import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { supplierService } from '../services/supplierService.ts';

const router = Router();

// GET /api/suppliers/purchase-orders — List all POs
router.get('/purchase-orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { supplier_id, store_id, status, limit, offset } = req.query;

    const pos = await supplierService.getPurchaseOrders(businessId, {
      supplier_id: supplier_id ? Number(supplier_id) : undefined,
      store_id: store_id ? Number(store_id) : undefined,
      status: status ? String(status) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });

    res.json(pos);
  } catch (error: any) {
    console.error('Fetch POs error:', error);
    res.status(500).json({ error: 'Failed to retrieve purchase orders.' });
  }
});

// GET /api/suppliers/purchase-orders/:id — Single PO details
router.get('/purchase-orders/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const po = await supplierService.getPurchaseOrderById(businessId, Number(req.params.id));
    if (!po) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json(po);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve purchase order details.' });
  }
});

// POST /api/suppliers/purchase-orders — Create PO
router.post('/purchase-orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const po = await supplierService.createPurchaseOrder(businessId, req.body);
    res.status(201).json({ success: true, message: 'Purchase order created.', purchaseOrder: po });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/purchase-orders/:id/receive — Receive items & update inventory
router.post('/purchase-orders/:id/receive', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { received_items } = req.body;
    const po = await supplierService.receivePurchaseOrder(businessId, Number(req.params.id), received_items || []);
    res.json({ success: true, message: 'Stock received and updated in store inventory.', purchaseOrder: po });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/suppliers/purchase-orders/:id/payment — Record payment
router.post('/purchase-orders/:id/payment', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const po = await supplierService.recordPayment(businessId, Number(req.params.id), req.body);
    res.json({ success: true, message: 'Supplier payment recorded and synchronized with expenses.', purchaseOrder: po });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/suppliers — List suppliers
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const search = req.query.search ? String(req.query.search) : undefined;
    const suppliers = await supplierService.getSuppliers(businessId, search);
    res.json(suppliers);
  } catch (error: any) {
    console.error('Fetch suppliers error:', error);
    res.status(500).json({ error: 'Failed to retrieve suppliers.' });
  }
});

// GET /api/suppliers/:id — Single supplier
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const supplier = await supplierService.getSupplierById(businessId, Number(req.params.id));
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
    res.json(supplier);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve supplier.' });
  }
});

// POST /api/suppliers — Create supplier
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const supplier = await supplierService.createSupplier(businessId, req.body);
    res.status(201).json(supplier);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/suppliers/:id — Update supplier
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const supplier = await supplierService.updateSupplier(businessId, Number(req.params.id), req.body);
    res.json(supplier);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/suppliers/:id — Delete supplier
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await supplierService.deleteSupplier(businessId, Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
