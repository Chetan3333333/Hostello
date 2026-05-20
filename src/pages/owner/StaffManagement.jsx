import { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { staffRoleLabels, staffStatusLabels } from '../../data/mockData';
import { Plus, Edit3, Trash2, Users, IndianRupee, UserCheck, UserX, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffManagement() {
  const { currentStaff, addStaff, updateStaff, deleteStaff, addStaffSalary, payStaffCash } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState({
    name: '', role: 'mess_cook', phone: '', salary: '', joinDate: new Date().toISOString().split('T')[0], status: 'present'
  });

  // Stats
  const totalSalary = currentStaff.reduce((sum, s) => sum + (s.salary || 0), 0);
  const presentCount = currentStaff.filter(s => s.status === 'present').length;
  const absentCount = currentStaff.filter(s => s.status === 'absent').length;
  const leaveCount = currentStaff.filter(s => s.status === 'leave').length;

  // Filters
  const filteredStaff = useMemo(() => {
    if (roleFilter === 'all') return currentStaff;
    return currentStaff.filter(s => s.role === roleFilter);
  }, [currentStaff, roleFilter]);

  const roleFilters = [
    { key: 'all', label: `All (${currentStaff.length})` },
    ...Object.entries(staffRoleLabels).map(([key, label]) => ({
      key,
      label: `${label} (${currentStaff.filter(s => s.role === key).length})`,
    })).filter(f => currentStaff.some(s => s.role === f.key)),
  ];

  const openAddModal = () => {
    setEditingStaff(null);
    setForm({ name: '', role: 'mess_cook', phone: '', salary: '', joinDate: new Date().toISOString().split('T')[0], status: 'present' });
    setModalOpen(true);
  };

  const openEditModal = (staff) => {
    setEditingStaff(staff);
    setForm({ name: staff.name, role: staff.role, phone: staff.phone, salary: staff.salary, joinDate: staff.joinDate, status: staff.status });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (form.phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(form.phone)) {
        alert('Please enter a valid 10-digit phone number.');
        return;
      }
    }

    const staffData = { ...form, salary: Number(form.salary) };
    if (editingStaff) {
      updateStaff(editingStaff.id, staffData);
      toast.success('Staff updated successfully!');
    } else {
      addStaff(staffData);
      toast.success('Staff member added!');
    }
    setModalOpen(false);
  };

  const handleDelete = (staff) => {
    setConfirmDialog({
      title: 'Remove Staff',
      message: `Remove ${staff.name} from staff?`,
      type: 'danger',
      confirmText: 'Remove',
      onConfirm: () => {
        deleteStaff(staff.id);
        toast.success('Staff member removed');
        setConfirmDialog(null);
      }
    });
  };

  const handleStatusChange = (staff, newStatus) => {
    updateStaff(staff.id, { status: newStatus });
    toast.success(`${staff.name} marked as ${staffStatusLabels[newStatus].label}`);
  };

  const handleAddSalary = (staff) => {
    const amount = window.prompt(`Add monthly salary to balance for ${staff.name}?\nEnter amount to add (Default is base salary):`, staff.salary);
    if (amount !== null && amount !== '' && !isNaN(Number(amount))) {
      addStaffSalary(staff.id, Number(amount));
    }
  };

  const handlePayCash = (staff) => {
    const defaultAmount = Math.max(0, staff.balance || 0);
    const amount = window.prompt(`Record cash handed to ${staff.name} (Advance or Settlement):\nAmount to deduct from balance:`, defaultAmount || '');
    if (amount !== null && amount !== '' && !isNaN(Number(amount))) {
      payStaffCash(staff.id, Number(amount));
    }
  };

  const columns = [
    {
      header: 'Name', accessor: 'name',
      render: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="staff-avatar">{row.name.charAt(0)}</div>
          <span style={{ fontWeight: 600, color: 'var(--dark-text)' }}>{row.name}</span>
        </div>
      )
    },
    {
      header: 'Role', accessor: 'role',
      render: row => <span className="badge badge-primary">{staffRoleLabels[row.role] || row.role}</span>
    },
    { header: 'Phone', accessor: 'phone' },
    {
      header: 'Monthly Salary', accessor: 'salary',
      render: row => <span style={{ fontWeight: 600, color: 'var(--success)' }}>₹{(row.salary || 0).toLocaleString()}/mo</span>
    },
    {
      header: 'Balance', accessor: 'balance',
      render: row => {
        const bal = row.balance || 0;
        return (
          <span className={`badge badge-${bal > 0 ? 'warning' : bal < 0 ? 'primary' : 'ghost'}`}>
            {bal > 0 ? `Pending ₹${bal.toLocaleString()}` : bal < 0 ? `Adv ₹${Math.abs(bal).toLocaleString()}` : 'Settled'}
          </span>
        );
      }
    },
    { header: 'Joined', accessor: 'joinDate' },
    {
      header: 'Status', accessor: 'status',
      render: row => {
        const status = staffStatusLabels[row.status] || { label: row.status, color: 'primary' };
        return (
          <select
            className={`staff-status-select status-${status.color}`}
            value={row.status}
            onChange={(e) => { e.stopPropagation(); handleStatusChange(row, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="present">✓ Present</option>
            <option value="absent">✗ Absent</option>
            <option value="leave">⏳ On Leave</option>
          </select>
        );
      }
    },
    {
      header: 'Actions', sortable: false,
      render: row => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleAddSalary(row); }} title="Add Monthly Salary">
            + Sal
          </button>
          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handlePayCash(row); }} title="Record Cash Paid">
            - Pay
          </button>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEditModal(row); }} title="Edit">
            <Edit3 size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(row); }} title="Remove" style={{ color: 'var(--danger)' }}>
            <Trash2 size={16} />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Staff Management</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Staff
          </button>
        </div>
      </div>

      <div className="stats-grid stagger-children">
        <StatCard icon={Users} label="Total Staff" value={currentStaff.length} color="primary" />
        <StatCard icon={IndianRupee} label="Monthly Expense" value={`₹${totalSalary.toLocaleString()}`} color="accent" />
        <StatCard icon={UserCheck} label="Present Today" value={presentCount} color="success" />
        <StatCard icon={UserX} label="Absent" value={absentCount} color="danger" />
        {leaveCount > 0 && <StatCard icon={Clock} label="On Leave" value={leaveCount} color="warning" />}
      </div>

      {/* Role Filters */}
      <div className="room-filters">
        {roleFilters.map(f => (
          <button key={f.key} className={`filter-chip ${roleFilter === f.key ? 'active' : ''}`} onClick={() => setRoleFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="dashboard-card">
        <DataTable
          columns={columns}
          data={filteredStaff}
          searchPlaceholder="Search by name, role, phone..."
          emptyMessage="No staff members found. Add your first staff member!"
        />
      </div>

      {/* Add/Edit Staff Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingStaff ? `Edit ${editingStaff.name}` : 'Add Staff Member'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Enter staff name" />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select className="form-input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                {Object.entries(staffRoleLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Phone Number *</label>
              <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="e.g. 9876543210" />
            </div>
            <div className="form-group">
              <label>Monthly Salary (₹) *</label>
              <input type="number" min="0" className="form-input" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} required placeholder="e.g. 12000" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Join Date</label>
              <input type="date" className="form-input" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">On Leave</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {editingStaff ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <Modal isOpen={!!confirmDialog} onClose={() => setConfirmDialog(null)} title={confirmDialog?.title || "Confirm Action"} size="sm">
        {confirmDialog && (
          <div>
            <p style={{ marginBottom: '24px', color: 'var(--dark-text-secondary)', fontSize: '1rem', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className={`btn btn-${confirmDialog.type}`} onClick={confirmDialog.onConfirm}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
