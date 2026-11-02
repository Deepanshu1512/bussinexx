import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { attendanceService } from '../services/attendanceService.ts';

const router = Router();
router.use(authenticateToken);

// GET /api/attendance/summary — Daily attendance stats
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const storeId = req.query.store_id ? Number(req.query.store_id) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined;

    const summary = await attendanceService.getTodaySummary(businessId, storeId, date);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve attendance summary.' });
  }
});

// GET /api/attendance — List attendance logs
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { date, start_date, end_date, store_id, employee_id, department_id, status, limit, offset } = req.query;

    const records = await attendanceService.getAttendance(businessId, {
      date: date ? String(date) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined,
      store_id: store_id ? Number(store_id) : undefined,
      employee_id: employee_id ? Number(employee_id) : undefined,
      department_id: department_id ? Number(department_id) : undefined,
      status: status ? String(status) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });

    res.json(records);
  } catch (error: any) {
    console.error('Fetch attendance error:', error);
    res.status(500).json({ error: 'Failed to retrieve attendance records.' });
  }
});

// POST /api/attendance/punch — Unified Punch In/Out
router.post('/punch', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const { employeeId, type, notes } = req.body;
    const record = await attendanceService.punch(businessId, Number(employeeId), type || 'in', notes);
    res.json({ success: true, message: `Punch ${type ? type.toUpperCase() : 'IN'} recorded successfully.`, attendance: record });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/attendance/correct — Correct attendance
router.post('/correct', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const managerUserId = req.user!.id;
    const record = await attendanceService.correctAttendance(businessId, { ...req.body, correctedBy: managerUserId });
    res.json({ success: true, message: 'Attendance correction saved.', attendance: record });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/attendance/check-in — Punch In
router.post('/check-in', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const record = await attendanceService.checkIn(businessId, req.body);
    res.status(201).json({ success: true, message: 'Check-in recorded successfully.', attendance: record });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/attendance/check-out — Punch Out
router.post('/check-out', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const record = await attendanceService.checkOut(businessId, req.body);
    res.json({ success: true, message: 'Check-out recorded successfully.', attendance: record });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/attendance/:id/correct — Manager correction
router.put('/:id/correct', async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user!.business_id;
    const managerUserId = req.user!.id;
    const record = await attendanceService.correctAttendance(businessId, Number(req.params.id), managerUserId, req.body);
    res.json({ success: true, message: 'Attendance correction saved.', attendance: record });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
