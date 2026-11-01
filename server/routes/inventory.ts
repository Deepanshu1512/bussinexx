import { Router } from 'express';
import { inventoryService } from '../services/inventoryService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET all products with store filtering and search
router.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { search, category_id, status, low_stock, store_id } = req.query;
    const products = await inventoryService.getProducts(businessId, {
      search: search ? String(search) : undefined,
      category_id: category_id ? Number(category_id) : undefined,
      status: status ? String(status) : undefined,
      low_stock: low_stock === 'true',
      store_id: store_id ? Number(store_id) : undefined
    });
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to fetch products.' });
  }
});

// GET /api/inventory/logs — Stock audit trail
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { product_id, store_id, limit, offset } = req.query;
    const logs = await inventoryService.getStockLogs(businessId, {
      productId: product_id ? Number(product_id) : undefined,
      storeId: store_id ? Number(store_id) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to fetch stock audit trail.' });
  }
});

// GET /api/inventory/export-csv — CSV catalog export
router.get('/export-csv', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const csvData = await inventoryService.exportProductsCSV(businessId, storeId);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bussinex_inventory_${Date.now()}.csv"`);
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to export inventory CSV.' });
  }
});

// POST /api/inventory/import-csv — Bulk CSV catalog import
router.post('/import-csv', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { csvContent, storeId } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV file content is required.' });
    }

    const result = await inventoryService.importProductsCSV(businessId, String(csvContent), storeId ? Number(storeId) : undefined);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to import CSV.' });
  }
});

// GET categories
router.get('/categories', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const categories = await inventoryService.getCategories(businessId);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST new category
router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const cat = await inventoryService.createCategory(businessId, name, description);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET inventory health metrics
router.get('/health', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const health = await inventoryService.getInventoryHealthStats(businessId, storeId);
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET product by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const product = await inventoryService.getProductById(businessId, Number(req.params.id), storeId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create product
router.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { sku, barcode, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description, store_id } = req.body;
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and Name are mandatory.' });
    }
    const product = await inventoryService.createProduct(businessId, {
      sku,
      barcode,
      name,
      category_id: category_id ? Number(category_id) : undefined,
      cost_price: Number(cost_price) || 0,
      selling_price: Number(selling_price) || 0,
      current_stock: Number(current_stock) || 0,
      min_stock_threshold: Number(min_stock_threshold) || 10,
      status,
      description,
      store_id: store_id ? Number(store_id) : undefined
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const product = await inventoryService.updateProduct(businessId, Number(req.params.id), req.body);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE delete product
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const result = await inventoryService.deleteProduct(businessId, Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST adjust stock
router.post('/:id/adjust', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { change_qty, reason, store_id } = req.body;
    if (change_qty === undefined || change_qty === 0) {
      return res.status(400).json({ error: 'A non-zero stock change quantity is required.' });
    }
    const result = await inventoryService.adjustStock(
      businessId, 
      Number(req.params.id), 
      Number(change_qty), 
      reason || 'Stock Level Adjustment',
      store_id ? Number(store_id) : undefined
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
