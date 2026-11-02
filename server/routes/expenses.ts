import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { expenseService } from '../services/expenseService.ts';

const router = Router();

// GET /api/expenses/categories — List categories
router.get('/categories', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const categories = await expenseService.getCategories(businessId);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve expense categories.' });
  }
});

// POST /api/expenses/categories — Add custom category
router.post('/categories', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const cat = await expenseService.createCategory(businessId, req.body.name);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/expenses/overview — Financial P&L and Cash Flow
router.get('/overview', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, start_date, end_date } = req.query;

    const overview = await expenseService.getFinancialOverview(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined
    });

    res.json(overview);
  } catch (error: any) {
    console.error('Fetch financial overview error:', error);
    res.status(500).json({ error: 'Failed to calculate financial overview.' });
  }
});

// GET /api/expenses — List expenses
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, category_id, start_date, end_date, payment_status, search, limit, offset } = req.query;

    const expenses = await expenseService.getExpenses(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      category_id: category_id ? Number(category_id) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined,
      payment_status: payment_status ? String(payment_status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });

    res.json(expenses);
  } catch (error: any) {
    console.error('Fetch expenses error:', error);
    res.status(500).json({ error: 'Failed to retrieve expenses.' });
  }
});

// POST /api/expenses — Record an expense
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const expense = await expenseService.createExpense(businessId, req.body);
    res.status(201).json({ success: true, message: 'Expense recorded successfully.', expense });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/expenses/:id — Delete expense
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await expenseService.deleteExpense(businessId, Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
