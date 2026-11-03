import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { employeeService } from '../services/employeeService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/employees/departments & /api/employees/meta/departments — List departments
router.get(['/departments', '/meta/departments'], async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const depts = await employeeService.getDepartments(businessId);
    res.json(depts);
  } catch (error: any) {
    console.error('Fetch departments error:', error);
    res.status(500).json({ error: 'Failed to retrieve departments.' });
  }
});

// POST /api/employees/departments & /api/employees/meta/departments — Create department
router.post(['/departments', '/meta/departments'], async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await employeeService.createDepartment(businessId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/employees/shifts & /api/employees/meta/shifts — List shifts
router.get(['/shifts', '/meta/shifts'], async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const shifts = await employeeService.getShifts(businessId);
    res.json(shifts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve shifts.' });
  }
});

// POST /api/employees/shifts & /api/employees/meta/shifts — Create shift
router.post(['/shifts', '/meta/shifts'], async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const result = await employeeService.createShift(businessId, req.body);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/employees/stats & /api/employees/stats/summary — Workforce statistics
router.get(['/stats', '/stats/summary'], async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const rawStoreId = req.query.store_id || req.query.storeId;
    const storeId = rawStoreId ? Number(rawStoreId) : undefined;
    const stats = await employeeService.getEmployeeStats(businessId, storeId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve workforce statistics.' });
  }
});

// GET /api/employees — List employees
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const store_id = req.query.store_id || req.query.storeId;
    const department_id = req.query.department_id || req.query.departmentId;
    const { status, search, limit, offset } = req.query;

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
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: 'Employee not found.' });

    const emp = await employeeService.getEmployeeById(businessId, id);
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });
    res.json(emp);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve employee profile.' });
  }
});

// POST /api/employees — Add new employee
router.post('/', async (req: AuthRequest, res: Response) => {
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
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid employee ID.' });

    const updated = await employeeService.updateEmployee(businessId, id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/employees/:id — Delete or terminate employee
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid employee ID.' });

    const result = await employeeService.deleteEmployee(businessId, id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
