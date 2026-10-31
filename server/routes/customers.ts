import { Router } from 'express';
import { customerService } from '../services/customerService.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authenticateToken);

// GET customers
router.get('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { search, tier } = req.query;
    const customers = await customerService.getCustomers(
      businessId,
      search ? String(search) : undefined,
      tier ? String(tier) : undefined
    );
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET customer by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const customer = await customerService.getCustomerById(businessId, Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json(customer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create customer
router.post('/', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const { name, email, phone, company, tier, address, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    const customer = await customerService.createCustomer(businessId, {
      name,
      email,
      phone,
      company,
      tier,
      address,
      notes
    });
    res.status(201).json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT update customer
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const customer = await customerService.updateCustomer(businessId, Number(req.params.id), req.body);
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE customer
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.business_id;
    const result = await customerService.deleteCustomer(businessId, Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
