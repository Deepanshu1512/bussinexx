import { Router } from 'express';
import { customerService } from '../services/customerService.ts';

const router = Router();

// GET customers
router.get('/', (req, res) => {
  try {
    const { search, tier } = req.query;
    const customers = customerService.getCustomers(
      search ? String(search) : undefined,
      tier ? String(tier) : undefined
    );
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET customer by ID
router.get('/:id', (req, res) => {
  try {
    const customer = customerService.getCustomerById(Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json(customer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create customer
router.post('/', (req, res) => {
  try {
    const { name, email, phone, company, tier, address, notes } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    const customer = customerService.createCustomer({
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
router.put('/:id', (req, res) => {
  try {
    const customer = customerService.updateCustomer(Number(req.params.id), req.body);
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE customer
router.delete('/:id', (req, res) => {
  try {
    const result = customerService.deleteCustomer(Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
