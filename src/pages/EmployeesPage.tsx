import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Building,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Eye,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Store as StoreIcon
} from 'lucide-react';
import { api } from '../services/api';
import { Employee, Department, Shift } from '../types';
import { useStore } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { formatINR, formatDate, formatPhone } from '../utils/formatters';

export const EmployeesPage: React.FC = () => {
  const { stores, selectedStoreId } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_employees: 0,
    active_employees: 0,
    probation_employees: 0,
    monthly_payroll_estimate: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>(selectedStoreId ? String(selectedStoreId) : 'all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Department Form
  const [newDeptData, setNewDeptData] = useState({ name: '', code: '', description: '' });

  // Employee Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    storeId: selectedStoreId || (stores[0]?.id || 1),
    departmentId: 1,
    designation: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentStatus: 'active' as const,
    shiftId: 1,
    baseSalary: 25000,
    hourlyRate: 150,
    paymentMethod: 'bank_transfer' as const,
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
    panNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    notes: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const storeIdParam = storeFilter !== 'all' ? Number(storeFilter) : (selectedStoreId || undefined);

      const [empsData, deptsData, shiftsData, statsData] = await Promise.all([
        api.employees.list({
          storeId: storeIdParam,
          departmentId: deptFilter ? Number(deptFilter) : undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        }),
        api.employees.getDepartments(),
        api.employees.getShifts(),
        api.employees.getStats(storeIdParam),
      ]);

      setEmployees(empsData);
      setDepartments(deptsData);
      setShifts(shiftsData);
      if (statsData) setStats(statsData);
    } catch (err: any) {
      showNotification(err.message || 'Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [storeFilter, deptFilter, statusFilter, selectedStoreId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenCreateModal = () => {
    setEditingEmployee(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      storeId: selectedStoreId || (stores[0]?.id || 1),
      departmentId: departments[0]?.id || 1,
      designation: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employmentStatus: 'active',
      shiftId: shifts[0]?.id || 1,
      baseSalary: 25000,
      hourlyRate: 150,
      paymentMethod: 'bank_transfer',
      bankAccountNumber: '',
      bankIfsc: '',
      bankName: '',
      panNumber: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      notes: '',
    });
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      address: emp.address || '',
      storeId: emp.store_id || (stores[0]?.id || 1),
      departmentId: emp.department_id || (departments[0]?.id || 1),
      designation: emp.designation,
      joiningDate: emp.joining_date.split('T')[0],
      employmentStatus: emp.employment_status as any,
      shiftId: emp.shift_id || (shifts[0]?.id || 1),
      baseSalary: emp.base_salary,
      hourlyRate: emp.hourly_rate,
      paymentMethod: emp.payment_method as any,
      bankAccountNumber: emp.bank_account_number || '',
      bankIfsc: emp.bank_ifsc || '',
      bankName: emp.bank_name || '',
      panNumber: emp.pan_number || '',
      emergencyContactName: emp.emergency_contact_name || '',
      emergencyContactPhone: emp.emergency_contact_phone || '',
      emergencyContactRelation: emp.emergency_contact_relation || '',
      notes: emp.notes || '',
    });
    setCreateModalOpen(true);
  };

  const handleSubmitEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.designation.trim()) {
      showNotification('Please fill in all mandatory employee details', 'error');
      return;
    }

    try {
      if (editingEmployee) {
        await api.employees.update(editingEmployee.id, {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          store_id: Number(formData.storeId),
          department_id: Number(formData.departmentId),
          designation: formData.designation,
          joining_date: formData.joiningDate,
          employment_status: formData.employmentStatus,
          shift_id: Number(formData.shiftId),
          base_salary: Number(formData.baseSalary),
          hourly_rate: Number(formData.hourlyRate),
          payment_method: formData.paymentMethod,
          bank_account_number: formData.bankAccountNumber,
          bank_ifsc: formData.bankIfsc,
          bank_name: formData.bankName,
          pan_number: formData.panNumber,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
          emergency_contact_relation: formData.emergencyContactRelation,
          notes: formData.notes,
        });
        showNotification('Employee record updated successfully');
      } else {
        await api.employees.create({
          store_id: Number(formData.storeId),
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          department_id: Number(formData.departmentId),
          designation: formData.designation,
          joining_date: formData.joiningDate,
          employment_status: formData.employmentStatus,
          shift_id: Number(formData.shiftId),
          base_salary: Number(formData.baseSalary),
          hourly_rate: Number(formData.hourlyRate),
          payment_method: formData.paymentMethod,
          bank_account_number: formData.bankAccountNumber,
          bank_ifsc: formData.bankIfsc,
          bank_name: formData.bankName,
          pan_number: formData.panNumber,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
          emergency_contact_relation: formData.emergencyContactRelation,
          notes: formData.notes,
        });
        showNotification('New employee onboarded with generated ID and leave balance');
      }
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Operation failed', 'error');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to delete employee ${emp.full_name || emp.first_name} (${emp.employee_code})?`)) {
      return;
    }
    try {
      await api.employees.delete(emp.id);
      showNotification('Employee deleted successfully');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete employee', 'error');
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptData.name.trim()) return;
    try {
      await api.employees.createDepartment(newDeptData);
      showNotification('Department created successfully');
      setNewDeptData({ name: '', code: '', description: '' });
      setDeptModalOpen(false);
      const depts = await api.employees.getDepartments();
      setDepartments(depts);
    } catch (err: any) {
      showNotification(err.message || 'Failed to create department', 'error');
    }
  };

  const getStatusBadgeVariant = (status: string): 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' => {
    switch (status) {
      case 'active':
        return 'emerald';
      case 'probation':
        return 'amber';
      case 'notice_period':
        return 'rose';
      case 'terminated':
      case 'resigned':
        return 'zinc';
      default:
        return 'sky';
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
            <Users className="w-6 h-6 text-indigo-400" />
            Employee Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Maintain staff directory, job roles, store allocations, and payroll profiles
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setDeptModalOpen(true)}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Building className="w-4 h-4 text-zinc-400" />
            <span>Departments</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex-1 sm:flex-initial justify-center px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.total_employees}</div>
          <div className="text-xs text-zinc-500 mt-1">Registered across stores</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Active Workforce</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.active_employees}</div>
          <div className="text-xs text-zinc-500 mt-1">Full-time & working staff</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">On Probation</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats.probation_employees}</div>
          <div className="text-xs text-zinc-500 mt-1">New recruits evaluation</div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase font-mono tracking-wider">Monthly Base Est.</span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatINR(stats.monthly_payroll_estimate)}</div>
          <div className="text-xs text-zinc-500 mt-1">Direct salary liability</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID (EMP-...), or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

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

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="probation">Probation</option>
            <option value="notice_period">Notice Period</option>
            <option value="resigned">Resigned</option>
            <option value="terminated">Terminated</option>
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

      {/* Employees Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Loading employee records...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Users}
              title="No employees found"
              description="Get started by adding staff members to assign jobs, track attendance, and run payroll."
              actionText="Add First Employee"
              onAction={handleOpenCreateModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400 uppercase font-mono tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Code / Dept</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Assigned Store</th>
                  <th className="py-3 px-4">Salary (Base)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold flex items-center justify-center uppercase text-xs">
                          {emp.first_name[0]}{emp.last_name ? emp.last_name[0] : ''}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {emp.full_name || `${emp.first_name} ${emp.last_name}`}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-2">
                            <span>{emp.email}</span>
                            <span>•</span>
                            <span>{formatPhone(emp.phone)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-indigo-400 font-medium">{emp.employee_code}</div>
                      <div className="text-[11px] text-zinc-400">{emp.department_name || 'General'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200 font-medium">{emp.designation}</div>
                      <div className="text-[11px] text-zinc-500">Joined {formatDate(emp.joining_date)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <StoreIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{emp.store_name || 'Central Office'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {formatINR(emp.base_salary)}
                      <span className="text-[10px] text-zinc-500 block font-normal font-mono">
                        {emp.payment_method.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={getStatusBadgeVariant(emp.employment_status)}>
                        {emp.employment_status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          title="View Profile & Emergency Contacts"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(emp)}
                          title="Edit Employee"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          title="Delete Employee"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingEmployee ? `Edit Employee: ${editingEmployee.employee_code}` : 'Onboard New Employee'}
        maxWidth="3xl"
      >
        <form onSubmit={handleSubmitEmployee} className="space-y-4 text-xs">
          {/* Basic Personal Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="Deepanshu"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="Sharma"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Work Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="employee@bussinex.com"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Phone Number *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="9876543210"
              />
            </div>
          </div>

          {/* Job & Store Allocations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Department *</label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Designation *</label>
              <input
                type="text"
                required
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                placeholder="Store Supervisor / Cashier"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Assigned Store *</label>
              <select
                value={formData.storeId}
                onChange={(e) => setFormData({ ...formData, storeId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code || 'MAIN'})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Joining Date *</label>
              <input
                type="date"
                required
                value={formData.joiningDate}
                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Employment Status *</label>
              <select
                value={formData.employmentStatus}
                onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="active">Active</option>
                <option value="probation">Probation</option>
                <option value="notice_period">Notice Period</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Assigned Shift</label>
              <select
                value={formData.shiftId}
                onChange={(e) => setFormData({ ...formData, shiftId: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time} - {s.end_time})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Salary & Bank Details */}
          <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
            <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px] block">
              Salary & Financial Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Monthly Base Salary (₹) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Hourly Overtime Rate (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Disbursement Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  placeholder="HDFC Bank / SBI"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Account Number</label>
                <input
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="50100234567890"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bankIfsc}
                  onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="HDFC0001234"
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact Information */}
          <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
            <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px] block">
              Emergency Contact Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Parent / Spouse name"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Emergency Phone</label>
                <input
                  type="text"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  placeholder="9876543211"
                />
              </div>
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Relationship</label>
                <input
                  type="text"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Father / Spouse"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20"
            >
              {editingEmployee ? 'Save Changes' : 'Confirm & Onboard'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Employee Profile Modal */}
      {viewingEmployee && (
        <Modal
          isOpen={!!viewingEmployee}
          onClose={() => setViewingEmployee(null)}
          title={`Employee Dossier: ${viewingEmployee.employee_code}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-lg flex items-center justify-center uppercase">
                {viewingEmployee.first_name[0]}{viewingEmployee.last_name ? viewingEmployee.last_name[0] : ''}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">
                    {viewingEmployee.full_name || `${viewingEmployee.first_name} ${viewingEmployee.last_name}`}
                  </h3>
                  <Badge variant={getStatusBadgeVariant(viewingEmployee.employment_status)}>
                    {viewingEmployee.employment_status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-zinc-400 font-mono text-[11px] mt-0.5">
                  {viewingEmployee.designation} • {viewingEmployee.department_name || 'General'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Email</span>
                <span className="text-zinc-200 font-medium">{viewingEmployee.email}</span>
              </div>
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Phone</span>
                <span className="text-zinc-200 font-medium">{formatPhone(viewingEmployee.phone)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Assigned Store</span>
                <span className="text-zinc-200 font-medium">{viewingEmployee.store_name || 'Central'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Joining Date</span>
                <span className="text-zinc-200 font-medium">{formatDate(viewingEmployee.joining_date)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Base Salary</span>
                <span className="text-indigo-400 font-bold">{formatINR(viewingEmployee.base_salary)} / mo</span>
              </div>
              <div>
                <span className="text-zinc-500 block font-mono text-[10px] uppercase">Payment Method</span>
                <span className="text-zinc-200 font-mono uppercase">{viewingEmployee.payment_method}</span>
              </div>
            </div>

            {/* Bank details */}
            <div className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-mono text-[10px] uppercase block">Bank Details</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Bank Name</span>
                  <span className="text-zinc-200 font-medium">{viewingEmployee.bank_name || '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Account No.</span>
                  <span className="text-zinc-200 font-mono">{viewingEmployee.bank_account_number || '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">IFSC Code</span>
                  <span className="text-zinc-200 font-mono">{viewingEmployee.bank_ifsc || '—'}</span>
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="p-3.5 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-1">
              <span className="text-zinc-500 font-mono text-[10px] uppercase block">Emergency Contact</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-zinc-500 text-[10px] block">Contact Person</span>
                  <span className="text-zinc-200 font-medium">{viewingEmployee.emergency_contact_name || '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Relationship</span>
                  <span className="text-zinc-200 font-medium">{viewingEmployee.emergency_contact_relation || '—'}</span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block">Phone</span>
                  <span className="text-zinc-200 font-mono">{formatPhone(viewingEmployee.emergency_contact_phone)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Departments Manager Modal */}
      <Modal
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        title="Manage Business Departments"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {/* Create new department */}
          <form onSubmit={handleCreateDepartment} className="space-y-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <span className="font-semibold text-zinc-300 font-mono uppercase text-[11px] block">
              Add New Department
            </span>
            <input
              type="text"
              required
              placeholder="Department Name (e.g., Logistics & Dispatch)"
              value={newDeptData.name}
              onChange={(e) => setNewDeptData({ ...newDeptData, name: e.target.value })}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
            />
            <input
              type="text"
              placeholder="Short Code (e.g., LOG)"
              value={newDeptData.code}
              onChange={(e) => setNewDeptData({ ...newDeptData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white font-mono"
            />
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Department
            </button>
          </form>

          {/* Current Departments List */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {departments.map((d) => (
              <div key={d.id} className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200 block">{d.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{d.code}</span>
                </div>
                <span className="text-zinc-400 font-mono text-[11px]">
                  {d.employee_count || 0} members
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default EmployeesPage;