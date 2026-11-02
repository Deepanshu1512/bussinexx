import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  User,
  ShieldCheck,
  AlertCircle,
  FileText,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { api } from '../services/api';
import { LeaveApplication, LeaveBalance, Employee } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../utils/formatters';

export const LeavesPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Employee Leave Balance
  const [selectedEmpForBalance, setSelectedEmpForBalance] = useState<number | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLeaveForReview, setSelectedLeaveForReview] = useState<LeaveApplication | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Apply Form
  const [applyForm, setApplyForm] = useState({
    employeeId: 0,
    leaveType: 'casual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
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
      const [leavesData, empsData] = await Promise.all([
        api.leaves.list({
          status: statusFilter || undefined,
          employeeId: employeeFilter ? Number(employeeFilter) : undefined,
          storeId: selectedStoreId || undefined,
        }),
        api.employees.list({ storeId: selectedStoreId || undefined }),
      ]);

      setLeaves(leavesData);
      setEmployees(empsData);

      if (empsData.length > 0 && (!selectedEmpForBalance || !empsData.find(e => e.id === selectedEmpForBalance))) {
        setSelectedEmpForBalance(empsData[0].id);
        fetchBalance(empsData[0].id);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load leave records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (empId: number) => {
    try {
      const bal = await api.leaves.getBalance(empId);
      setLeaveBalance(bal);
    } catch (err) {
      setLeaveBalance(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, employeeFilter, selectedStoreId]);

  const handleSelectBalanceEmp = (empId: number) => {
    setSelectedEmpForBalance(empId);
    fetchBalance(empId);
  };

  const handleOpenApplyModal = () => {
    setApplyForm({
      employeeId: selectedEmpForBalance || (employees[0]?.id || 1),
      leaveType: 'casual',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: '',
    });
    setApplyModalOpen(true);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.employeeId || !applyForm.reason.trim()) {
      showNotification('Please provide employee and a valid leave justification reason', 'error');
      return;
    }

    try {
      const res = await api.leaves.apply(applyForm);
      showNotification(res.message || 'Leave request submitted successfully');
      setApplyModalOpen(false);
      loadData();
      if (selectedEmpForBalance) fetchBalance(selectedEmpForBalance);
    } catch (err: any) {
      showNotification(err.message || 'Failed to apply leave', 'error');
    }
  };

  const handleOpenReview = (leave: LeaveApplication) => {
    setSelectedLeaveForReview(leave);
    setReviewRemarks('');
    setReviewModalOpen(true);
  };

  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedLeaveForReview) return;
    try {
      const res = await api.leaves.review(selectedLeaveForReview.id, status, reviewRemarks);
      showNotification(res.message || `Leave application ${status}`);
      setReviewModalOpen(false);
      loadData();
      if (selectedEmpForBalance) fetchBalance(selectedEmpForBalance);
    } catch (err: any) {
      showNotification(err.message || `Failed to ${status} leave`, 'error');
    }
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'pending');
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="amber">PENDING APPROVAL</Badge>;
      case 'approved':
        return <Badge variant="emerald">APPROVED</Badge>;
      case 'rejected':
        return <Badge variant="rose">REJECTED</Badge>;
      case 'cancelled':
        return <Badge variant="zinc">CANCELLED</Badge>;
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

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-indigo-400" />
            Leave Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Apply, track and approve employee leaves with automated balance adjustments and attendance synchronization
          </p>
        </div>
        <button
          onClick={handleOpenApplyModal}
          className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Leave Balance Showcase for Selected Employee */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-200 uppercase font-mono tracking-wider">
              Employee Annual Leave Entitlement ({new Date().getFullYear()})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Employee:</span>
            <select
              value={selectedEmpForBalance || ''}
              onChange={(e) => handleSelectBalanceEmp(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employee_code} - {e.full_name || e.first_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {leaveBalance ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Casual Leave</span>
              <div className="text-lg font-bold text-white mt-0.5">
                {leaveBalance.casual_leave_total - leaveBalance.casual_leave_used}{' '}
                <span className="text-xs text-zinc-500 font-normal">/ {leaveBalance.casual_leave_total} days left</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (leaveBalance.casual_leave_used / (leaveBalance.casual_leave_total || 1)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Sick Leave</span>
              <div className="text-lg font-bold text-white mt-0.5">
                {leaveBalance.sick_leave_total - leaveBalance.sick_leave_used}{' '}
                <span className="text-xs text-zinc-500 font-normal">/ {leaveBalance.sick_leave_total} days left</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (leaveBalance.sick_leave_used / (leaveBalance.sick_leave_total || 1)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Paid Annual Leave</span>
              <div className="text-lg font-bold text-white mt-0.5">
                {leaveBalance.paid_leave_total - leaveBalance.paid_leave_used}{' '}
                <span className="text-xs text-zinc-500 font-normal">/ {leaveBalance.paid_leave_total} days left</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (leaveBalance.paid_leave_used / (leaveBalance.paid_leave_total || 1)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
              <span className="text-[10px] text-zinc-500 uppercase font-mono block">Unpaid Leave (LWP)</span>
              <div className="text-lg font-bold text-amber-400 mt-0.5">
                {leaveBalance.unpaid_leave_used}{' '}
                <span className="text-xs text-zinc-500 font-normal">days deducted</span>
              </div>
              <span className="text-[10px] text-zinc-500 mt-2 block">Deducted from monthly payroll</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 p-2">Select an employee to view leave balance.</div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Applications:</span>
          <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
            {pendingLeaves.length} Pending Approval
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
            {approvedLeaves.length} Approved
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

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
            title="Refresh"
            className="p-2 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leaves Applications Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Loading leave requests...</span>
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={CalendarDays}
              title="No leave applications on record"
              description="Employees have not submitted any leave requests matching the active filter."
              actionText="Apply for Leave"
              onAction={handleOpenApplyModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-white">
                          {l.employee_name || 'Staff Member'}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {l.employee_code} • {l.department_name || 'Operations'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium">
                      <span className="uppercase text-indigo-400">{l.leave_type} LEAVE</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200 font-medium">
                        {formatDate(l.start_date)} → {formatDate(l.end_date)}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {l.total_days} {l.total_days === 1 ? 'day' : 'days'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="text-zinc-300 truncate" title={l.reason}>
                        {l.reason}
                      </div>
                      {l.manager_remarks && (
                        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1 italic truncate">
                          <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>Manager: {l.manager_remarks}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(l.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {l.status === 'pending' ? (
                        <button
                          onClick={() => handleOpenReview(l)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                        >
                          Review Request
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Submit Leave Application"
        maxWidth="md"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Staff Member *</label>
            <select
              required
              value={applyForm.employeeId}
              onChange={(e) => setApplyForm({ ...applyForm, employeeId: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employee_code} - {e.full_name || e.first_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Leave Type *</label>
            <select
              value={applyForm.leaveType}
              onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="casual">Casual Leave (CL)</option>
              <option value="sick">Sick Leave (SL)</option>
              <option value="paid">Paid Annual Leave (PL)</option>
              <option value="unpaid">Unpaid Leave / Loss of Pay (LWP)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">End Date *</label>
              <input
                type="date"
                required
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Reason / Justification *</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Attending family wedding / Medical appointment"
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <span className="font-semibold text-zinc-300 block">System Automation</span>
            <p>• Automatically checks remaining balance for this year.</p>
            <p>• When approved by manager, automatically registers "On Leave" in daily attendance.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setApplyModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20"
            >
              Submit Application
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Leave Modal */}
      {selectedLeaveForReview && (
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={`Review Leave: ${selectedLeaveForReview.employee_name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Staff Member</span>
                <span className="text-white font-semibold">{selectedLeaveForReview.employee_name} ({selectedLeaveForReview.employee_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Type</span>
                <span className="text-indigo-400 font-mono uppercase font-bold">{selectedLeaveForReview.leave_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Dates</span>
                <span className="text-zinc-200">{formatDate(selectedLeaveForReview.start_date)} to {formatDate(selectedLeaveForReview.end_date)} ({selectedLeaveForReview.total_days} days)</span>
              </div>
              <div className="border-t border-zinc-800 pt-2">
                <span className="text-zinc-500 uppercase font-mono text-[10px] block mb-1">Reason</span>
                <p className="text-zinc-300">{selectedLeaveForReview.reason}</p>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Manager Remarks / Decision Notes</label>
              <textarea
                rows={2}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Optional notes regarding the approval or rejection"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('rejected')}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-500/20"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('approved')}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-500/20"
              >
                Approve Leave
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default LeavesPage;