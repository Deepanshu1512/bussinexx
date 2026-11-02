import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { employeeService } from '../services/employeeService.ts';

const router = Router();

// GET /api/employees/departments — List departments
router.get('/departments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const depts = await employeeService.getDepartments(businessId);
    res.json(depts);
  } catch (error: any) {
    console.error('Fetch departments error:', error);
    res.status(500).json({ error: 'Failed to retrieve departments.' });
  }
});

// POST /api/employees/departments — Create department
router.post('/departments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await employeeService.createDepartment(businessId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/employees/shifts — List shifts
router.get('/shifts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const shifts = await employeeService.getShifts(businessId);
    res.json(shifts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve shifts.' });
  }
});

// POST /api/employees/shifts — Create shift
router.post('/shifts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await employeeService.createShift(businessId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/employees/stats — Workforce statistics
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const stats = await employeeService.getEmployeeStats(businessId, storeId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve workforce statistics.' });
  }
});

// GET /api/employees — List employees
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { store_id, department_id, status, search, limit, offset } = req.query;

    const employees = await employeeService.getEmployees(businessId, {
      store_id: store_id ? Number(store_id) : undefined,
      department_id: department_id ? Number(department_id) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });

    res.json(employees);
  } catch (error: any) {
    console.error('Fetch employees error:', error);
    res.status(500).json({ error: 'Failed to retrieve employees.' });
  }
});

// GET /api/employees/:id — Single employee details
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const emp = await employeeService.getEmployeeById(businessId, Number(req.params.id));
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });
    res.json(emp);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve employee profile.' });
  }
});

// POST /api/employees — Add new employee
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const newEmp = await employeeService.createEmployee(businessId, req.body);
    res.status(201).json(newEmp);
  } catch (error: any) {
    console.error('Create employee error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/employees/:id — Update employee
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const updated = await employeeService.updateEmployee(businessId, Number(req.params.id), req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/employees/:id — Delete or terminate employee
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await employeeService.deleteEmployee(businessId, Number(req.params.id));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
