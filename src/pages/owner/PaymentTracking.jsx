import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { IndianRupee, Clock, AlertTriangle, Plus, CheckCircle } from 'lucide-react';

export default function PaymentTracking() {
  const { currentPayments, currentTenants, addPayment, recordPayment } = useApp();
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tenantId: '', amount: '', month: '', method: 'UPI', receiptNote: '' });

  const months = [...new Set(currentPayments.map(p => p.month))].sort().reverse();

  const filtered = useMemo(() => {
    let result = currentPayments;
    if (monthFilter !== 'all') result = result.filter(p => p.month === monthFilter);
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    return result;
  }, [currentPayments, monthFilter, statusFilter]);

  const totalCollected = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = filtered.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const overdueCount = filtered.filter(p => p.status === 'overdue').length;

  const handleRecordPayment = (payment) => {
    if (confirm(`Mark ₹${payment.amount.toLocaleString()} from ${payment.tenantName} as paid?`)) {
      recordPayment(payment.id);
    }
  };

  const handleAddPayment = (e) => {
    e.preventDefault();
    const tenant = currentTenants.find(t => t.id === form.tenantId);
    if (!tenant) return;
    addPayment({
      tenantId: tenant.id,
      tenantName: tenant.name,
      roomNumber: tenant.roomNumber,
      amount: Number(form.amount) || tenant.rentAmount,
      month: form.month,
      dueDate: `${form.month}-05`,
      paidDate: new Date().toISOString().split('T')[0],
      status: 'paid',
      method: form.method,
      receiptNote: form.receiptNote || `Rent for ${form.month}`,
    });
    setModalOpen(false);
  };

  const columns = [
    { header: 'Tenant', accessor: 'tenantName', render: row => <span style={{ fontWeight: 600, color: 'var(--dark-text)' }}>{row.tenantName}</span> },
    { header: 'Room', accessor: 'roomNumber', render: row => <span className="badge badge-primary">Room {row.roomNumber}</span> },
    { header: 'Amount', accessor: 'amount', render: row => <span style={{ fontWeight: 600 }}>₹{row.amount.toLocaleString()}</span> },
    { header: 'Month', accessor: 'month' },
    { header: 'Due Date', accessor: 'dueDate' },
    { header: 'Paid Date', accessor: 'paidDate', render: row => row.paidDate || '—' },
    { header: 'Method', accessor: 'method', render: row => row.method || '—' },
    {
      header: 'Status', accessor: 'status',
      render: row => (
        <span className={`badge badge-${row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'danger' : 'warning'}`}>
          {row.status === 'paid' ? '✓ Paid' : row.status === 'overdue' ? '⚠ Overdue' : '⏳ Pending'}
        </span>
      )
    },
    {
      header: 'Action', sortable: false,
      render: row => row.status !== 'paid' ? (
        <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleRecordPayment(row); }}>
          <CheckCircle size={14} /> Mark Paid
        </button>
      ) : null
    },
  ];

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Payment Tracking</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Record Payment
          </button>
        </div>
      </div>

      <div className="stats-grid stagger-children">
        <StatCard icon={IndianRupee} label="Collected" value={`₹${totalCollected.toLocaleString()}`} color="success" />
        <StatCard icon={Clock} label="Pending" value={`₹${totalPending.toLocaleString()}`} color="warning" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdueCount} color="danger" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="room-filters" style={{ marginBottom: 0 }}>
          {['all', 'paid', 'pending', 'overdue'].map(s => (
            <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-card">
        <DataTable columns={columns} data={filtered} searchPlaceholder="Search by tenant name or room..." emptyMessage="No payments found for the selected filters." pageSize={15} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment">
        <form onSubmit={handleAddPayment}>
          <div className="form-group">
            <label>Select Tenant *</label>
            <select className="form-input" value={form.tenantId} onChange={e => {
              const t = currentTenants.find(t => t.id === e.target.value);
              setForm({...form, tenantId: e.target.value, amount: t?.rentAmount || '' });
            }} required>
              <option value="">Choose tenant</option>
              {currentTenants.map(t => <option key={t.id} value={t.id}>{t.name} - Room {t.roomNumber}</option>)}
            </select>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Amount (₹) *</label>
              <input type="number" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Month *</label>
              <input type="month" className="form-input" value={form.month} onChange={e => setForm({...form, month: e.target.value})} required />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Payment Method</label>
              <select className="form-input" value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
                <option>UPI</option><option>Cash</option><option>Bank Transfer</option><option>Cheque</option>
              </select>
            </div>
            <div className="form-group">
              <label>Note</label>
              <input className="form-input" value={form.receiptNote} onChange={e => setForm({...form, receiptNote: e.target.value})} placeholder="Optional receipt note" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-success">Record Payment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
