import { Router } from 'express';
import { inventoryService } from '../services/inventoryService.ts';

const router = Router();

// GET all products with filtering
router.get('/', (req, res) => {
  try {
    const { search, category_id, status, low_stock } = req.query;
    const products = inventoryService.getProducts({
      search: search ? String(search) : undefined,
      category_id: category_id ? Number(category_id) : undefined,
      status: status ? String(status) : undefined,
      low_stock: low_stock === 'true'
    });
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET categories
router.get('/categories', (req, res) => {
  try {
    const categories = inventoryService.getCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST new category
router.post('/categories', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const cat = inventoryService.createCategory(name, description);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET inventory health metrics
router.get('/health', (req, res) => {
  try {
    const health = inventoryService.getInventoryHealthStats();
    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET product by ID
router.get('/:id', (req, res) => {
  try {
    const product = inventoryService.getProductById(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create product
router.post('/', (req, res) => {
  try {
    const { sku, name, category_id, cost_price, selling_price, current_stock, min_stock_threshold, status, description } = req.body;
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and Name are mandatory.' });
    }
    const product = inventoryService.createProduct({
      sku,
      name,
      category_id: category_id ? Number(category_id) : undefined,
      cost_price: Number(cost_price) || 0,
      selling_price: Number(selling_price) || 0,
      current_stock: Number(current_stock) || 0,
      min_stock_threshold: Number(min_stock_threshold) || 10,
      status,
      description
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update product
router.put('/:id', (req, res) => {
  try {
    const product = inventoryService.updateProduct(Number(req.params.id), req.body);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE product
router.delete('/:id', (req, res) => {
  try {
    const result = inventoryService.deleteProduct(Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST stock adjustment
router.post('/:id/adjust', (req, res) => {
  try {
    const { change_qty, reason } = req.body;
    if (change_qty === undefined || !reason) {
      return res.status(400).json({ error: 'change_qty and reason are required.' });
    }
    const result = inventoryService.adjustStock(
      Number(req.params.id),
      Number(change_qty),
      String(reason)
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
