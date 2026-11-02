import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit2,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  UserX,
  Store as StoreIcon,
  Timer,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { Attendance, Employee } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatDateTime } from '../utils/formatters';

export const AttendancePage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId ? String(selectedStoreId) : 'all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');

  // Punch modal
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchEmployeeId, setPunchEmployeeId] = useState<number>(0);
  const [punchType, setPunchType] = useState<'in' | 'out'>('in');
  const [punchNotes, setPunchNotes] = useState('');

  // Correction modal
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctingRecord, setCorrectingRecord] = useState<Attendance | null>(null);
  const [correctionForm, setCorrectionForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: 'present',
    reason: '',
  });

  // Notification
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const storeIdParam = storeFilter !== 'all' ? Number(storeFilter) : (selectedStoreId || undefined);

      const [records, emps] = await Promise.all([
        api.attendance.list({
          date: selectedDate,
          storeId: storeIdParam,
          employeeId: employeeFilter ? Number(employeeFilter) : undefined,
        }),
        api.employees.list({ storeId: storeIdParam }),
      ]);

      setAttendanceRecords(records);
      setEmployees(emps);
      if (emps.length > 0 && !punchEmployeeId) {
        setPunchEmployeeId(emps[0].id);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, storeFilter, employeeFilter, selectedStoreId]);

  const handlePunchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchEmployeeId) {
      showNotification('Please select an employee to log punch', 'error');
      return;
    }

    try {
      const res = await api.attendance.punch(punchEmployeeId, punchType, punchNotes);
      showNotification(res.message || `Punch ${punchType.toUpperCase()} recorded successfully`);
      setPunchModalOpen(false);
      setPunchNotes('');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to record punch', 'error');
    }
  };

  const handleOpenCorrection = (rec: Attendance) => {
    setCorrectingRecord(rec);
    setCorrectionForm({
      checkInTime: rec.check_in_time ? rec.check_in_time.slice(0, 16) : '',
      checkOutTime: rec.check_out_time ? rec.check_out_time.slice(0, 16) : '',
      status: rec.status,
      reason: '',
    });
    setCorrectionModalOpen(true);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    if (!correctionForm.reason.trim()) {
      showNotification('Audit requires a valid justification reason for manual correction', 'error');
      return;
    }

    try {
      await api.attendance.correct({
        attendanceId: correctingRecord.id,
        checkInTime: correctionForm.checkInTime || undefined,
        checkOutTime: correctionForm.checkOutTime || undefined,
        status: correctionForm.status,
        reason: correctionForm.reason,
      });
      showNotification('Attendance corrected and audited');
      setCorrectionModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to correct record', 'error');
    }
  };

  // Summaries
  const totalEmployeesCount = employees.length;
  const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
  const lateCount = attendanceRecords.filter((r) => r.late_minutes > 0).length;
  const overtimeHoursTotal = attendanceRecords.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="emerald">PRESENT</Badge>;
      case 'half_day':
        return <Badge variant="amber">HALF DAY</Badge>;
      case 'absent':
        return <Badge variant="rose">ABSENT</Badge>;
      case 'on_leave':
        return <Badge variant="sky">ON LEAVE</Badge>;
      case 'holiday':
      case 'weekend':
        return <Badge variant="zinc">{status.toUpperCase()}</Badge>;
      default:
        return <Badge variant="zinc">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header & Punch In/Out Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-indigo-400" />
            Attendance & Shifts
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time check-in, late arrival detection, overtime tracking and manager audit corrections
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => { setPunchType('in'); setPunchModalOpen(true); }}
            className="flex-1 sm:flex-initial justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Punch In</span>
          </button>
          <button
            onClick={() => { setPunchType('out'); setPunchModalOpen(true); }}
            className="flex-1 sm:flex-initial justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <UserX className="w-4 h-4" />
            <span>Punch Out</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Present Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {presentCount} <span className="text-xs text-zinc-500 font-normal">/ {totalEmployeesCount}</span>
          </div>
          <div className="text-xs text-emerald-400 mt-1">
            {totalEmployeesCount ? `${Math.round((presentCount / totalEmployeesCount) * 100)}% attendance rate` : 'No staff'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Late Arrivals</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{lateCount}</div>
          <div className="text-xs text-zinc-500 mt-1">Exceeded shift grace window</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Overtime Logged</span>
            <Timer className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400">{overtimeHoursTotal.toFixed(1)} hrs</div>
          <div className="text-xs text-zinc-500 mt-1">Eligible for payroll incentive</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Selected Date</span>
            <Calendar className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-lg font-bold text-white">{formatDate(selectedDate)}</div>
          <div className="text-xs text-zinc-500 mt-1">Asia/Kolkata timezone</div>
        </div>
      </div>

      {/* Date & Filter Controls */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-700/80">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-1.5 rounded-xl text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Store Filter */}
          {stores.length > 0 && (
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">🏬 All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Employee Filter */}
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-xs truncate"
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_code} - {e.full_name || e.first_name}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Refresh Attendance"
            className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Fetching attendance rolls...</span>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Clock}
              title="No attendance punches logged for this date"
              description="Employees have not punched in yet. Punch in staff to initiate shift tracking."
              actionText="Punch In Staff Member"
              onAction={() => { setPunchType('in'); setPunchModalOpen(true); }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Late / Overtime</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Audit Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {attendanceRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-white">
                          {rec.employee_name || 'Staff Member'}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {rec.employee_code} • {rec.department_name || 'Operations'}
                        </div>
                        {rec.is_manually_corrected ? (
                          <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-mono mt-0.5">
                            <FileCheck className="w-3 h-3" /> Corrected by Manager
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {rec.check_in_time ? (
                        <div>
                          <span className="text-emerald-400 font-medium">
                            {formatDateTime(rec.check_in_time).split(',')[1]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {rec.check_out_time ? (
                        <div>
                          <span className="text-amber-400 font-medium">
                            {formatDateTime(rec.check_out_time).split(',')[1]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600">Pending</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-200">
                      {rec.total_working_hours ? `${rec.total_working_hours.toFixed(2)} hrs` : '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="space-y-0.5">
                        {rec.late_minutes > 0 && (
                          <span className="text-amber-400 block text-[11px]">
                            +{rec.late_minutes}m Late
                          </span>
                        )}
                        {rec.overtime_hours > 0 && (
                          <span className="text-indigo-400 block text-[11px]">
                            +{rec.overtime_hours.toFixed(1)}h OT
                          </span>
                        )}
                        {rec.late_minutes === 0 && rec.overtime_hours === 0 && (
                          <span className="text-zinc-500">On Time</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenCorrection(rec)}
                        title="Audit & Correct Attendance"
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                        Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Punch In / Out Modal */}
      <Modal
        isOpen={punchModalOpen}
        onClose={() => setPunchModalOpen(false)}
        title={`Staff ${punchType === 'in' ? 'Check In (Punch In)' : 'Check Out (Punch Out)'}`}
        maxWidth="md"
      >
        <form onSubmit={handlePunchSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Select Staff Member *</label>
            <select
              required
              value={punchEmployeeId}
              onChange={(e) => setPunchEmployeeId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employee_code} - {e.full_name || `${e.first_name} ${e.last_name}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Punch Action</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPunchType('in')}
                className={`py-2 rounded-xl font-semibold border transition-all ${
                  punchType === 'in'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                Punch IN
              </button>
              <button
                type="button"
                onClick={() => setPunchType('out')}
                className={`py-2 rounded-xl font-semibold border transition-all ${
                  punchType === 'out'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                Punch OUT
              </button>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Optional Notes / Location</label>
            <input
              type="text"
              value={punchNotes}
              onChange={(e) => setPunchNotes(e.target.value)}
              placeholder="e.g. Front desk kiosk / Store opening"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <span className="font-semibold text-zinc-300 block">System Verification</span>
            <p>• Automatically stamped using current server time.</p>
            <p>• Prevents duplicate punch-ins on the same day.</p>
            <p>• Compares arrival time against assigned shift grace window.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPunchModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md ${
                punchType === 'in'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
              }`}
            >
              Record {punchType.toUpperCase()}
            </button>
          </div>
        </form>
      </Modal>

      {/* Manager Correction Modal */}
      {correctingRecord && (
        <Modal
          isOpen={correctionModalOpen}
          onClose={() => setCorrectionModalOpen(false)}
          title={`Correct Attendance: ${correctingRecord.employee_name}`}
          maxWidth="md"
        >
          <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Attendance Status *</label>
              <select
                value={correctionForm.status}
                onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="present">Present</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
                <option value="on_leave">On Leave</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Check In Time</label>
                <input
                  type="datetime-local"
                  value={correctionForm.checkInTime}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, checkInTime: e.target.value })}
                  className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Check Out Time</label>
                <input
                  type="datetime-local"
                  value={correctionForm.checkOutTime}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, checkOutTime: e.target.value })}
                  className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                Audit Reason (Mandatory) *
              </label>
              <textarea
                required
                rows={3}
                value={correctionForm.reason}
                onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                placeholder="e.g. Employee forgot to punch out due to internet outage at the store"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20"
              >
                Save Audit Correction
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
export default AttendancePage;