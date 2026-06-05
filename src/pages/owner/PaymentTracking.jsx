import { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { IndianRupee, Clock, AlertTriangle, Plus, CheckCircle, MessageCircle } from 'lucide-react';
import { getCurrentMonth, toLocalDateString } from '../../lib/date';

export default function PaymentTracking() {
  const { currentPayments, currentTenants, addPayment, recordPayment, revertPayment, deletePayment, updatePayment } = useApp();
  const currentMonthStr = getCurrentMonth();
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [paymentDialog, setPaymentDialog] = useState(null);
  const [form, setForm] = useState({ tenantId: '', amount: '', month: currentMonthStr, receiptNote: '', status: 'pending' });

  const months = [...new Set(currentPayments.map(p => p.month))].sort().reverse();

  const filtered = useMemo(() => {
    let result = currentPayments;
    if (monthFilter !== 'all') result = result.filter(p => p.month === monthFilter);
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);
    return result;
  }, [currentPayments, monthFilter, statusFilter]);

  const totalCollected = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = filtered.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const totalOverdue = filtered.filter(p => p.status === 'overdue').reduce((s, p) => s + p.amount, 0);

  const handleRecordPayment = (payment) => {
    setPaymentDialog({ payment, amount: payment.amount });
  };

  const submitRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentDialog) return;
    
    const { payment, amount } = paymentDialog;
    const amountReceived = Number(amount);
    
    if (isNaN(amountReceived) || amountReceived <= 0 || amountReceived > payment.amount) {
      alert('Please enter a valid amount up to the total bill amount.');
      return;
    }

    const success = await recordPayment(payment.id, amountReceived);
    if (success) setPaymentDialog(null);
  };

  const handleRevertPayment = (payment) => {
    revertPayment(payment.id);
  };

  const handleDeletePayment = (payment) => {
    setConfirmDialog({
      title: 'Delete Payment',
      message: `WARNING: Are you sure you want to permanently delete this payment record for ${payment.tenantName}? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        const success = await deletePayment(payment.id);
        if (success) setConfirmDialog(null);
      }
    });
  };

  const handleWriteOffPayment = (payment) => {
    setConfirmDialog({
      title: 'Write Off Debt',
      message: `Are you sure you want to write off ₹${payment.amount.toLocaleString()} for ${payment.tenantName}? This will archive the debt and remove it from your Dashboard's Total Outstanding amount.`,
      type: 'warning',
      confirmText: 'Write Off Debt',
      onConfirm: async () => {
        const success = await updatePayment(payment.id, { status: 'written_off' });
        if (success) setConfirmDialog(null);
      }
    });
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const tenant = currentTenants.find(t => t.id === form.tenantId);
    if (!tenant) return;
    const duplicate = currentPayments.find(p => p.tenantId === tenant.id && p.month === form.month);
    if (duplicate) {
      alert(`A payment record for ${tenant.name} for ${form.month} already exists!`);
      return;
    }
    const success = await addPayment({
      tenantId: tenant.id,
      tenantName: tenant.name,
      roomNumber: tenant.roomNumber,
      amount: Number(form.amount) || tenant.rentAmount,
      month: form.month,
      dueDate: `${form.month}-10`,
      paidDate: form.status === 'paid' ? toLocalDateString() : null,
      status: form.status,
      receiptNote: form.receiptNote || `Rent for ${form.month}`,
    });
    if (!success) return;
    setForm({ tenantId: '', amount: '', month: currentMonthStr, receiptNote: '', status: 'pending' });
    setModalOpen(false);
  };

  const columns = [
    { header: 'Tenant', accessor: 'tenantName', render: row => <span style={{ fontWeight: 600, color: 'var(--dark-text)' }}>{row.tenantName}</span> },
    { header: 'Room', accessor: 'roomNumber', render: row => <span className="badge badge-primary">Room {row.roomNumber}</span> },
    { header: 'Amount', accessor: 'amount', render: row => <span style={{ fontWeight: 600 }}>₹{row.amount.toLocaleString()}</span> },
    { header: 'Month', accessor: 'month' },
    { header: 'Due Date', accessor: 'dueDate' },
    { header: 'Paid Date', accessor: 'paidDate', render: row => row.paidDate || '—' },
    {
      header: 'Status', accessor: 'status',
      render: row => (
        <span className={`badge badge-${row.status === 'paid' ? 'success' : row.status === 'overdue' ? 'danger' : row.status === 'written_off' ? 'ghost' : 'warning'}`}>
          {row.status === 'paid' ? '✓ Paid' : row.status === 'overdue' ? '⚠ Overdue' : row.status === 'written_off' ? 'Archived' : '⏳ Pending'}
        </span>
      )
    },
    {
      header: 'Action', sortable: false,
      render: row => {
        if (row.status === 'paid' || row.status === 'written_off') {
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleRevertPayment(row); }} title="Undo payment">
                Undo
              </button>
            </div>
          );
        }
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleRecordPayment(row); }}>
              <CheckCircle size={14} /> Mark Paid
            </button>
            {row.status === 'overdue' && (
              <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleWriteOffPayment(row); }} title="Write off unrecoverable debt">
                Write-off
              </button>
            )}
            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeletePayment(row); }} title="Delete payment">
              Delete
            </button>
            <a 
              href={`https://wa.me/91${currentTenants.find(t => t.id === row.tenantId)?.phone || ''}?text=${encodeURIComponent(`Hi ${row.tenantName}, your hostel rent of ₹${row.amount} for the month of ${row.month} is due. Please pay via UPI at the earliest.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <MessageCircle size={14} /> Remind
            </a>
          </div>
        );
      }
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
        <StatCard icon={AlertTriangle} label="Overdue" value={`₹${totalOverdue.toLocaleString()}`} color="danger" />
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="room-filters" style={{ marginBottom: 0 }}>
          {['all', 'paid', 'pending', 'overdue', 'written_off'].map(s => (
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
              <input type="number" min="1" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Month *</label>
              <input type="month" className="form-input" value={form.month} onChange={e => setForm({...form, month: e.target.value})} required />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Status *</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})} required>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Note</label>
            <input className="form-input" value={form.receiptNote} onChange={e => setForm({...form, receiptNote: e.target.value})} placeholder="Optional receipt note" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-success">Record Payment</button>
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

      {/* Record Payment Dialog */}
      <Modal isOpen={!!paymentDialog} onClose={() => setPaymentDialog(null)} title="Record Payment" size="sm">
        {paymentDialog && (
          <form onSubmit={submitRecordPayment}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: 0, color: 'var(--dark-text-secondary)', fontSize: '0.9rem' }}>
                Recording payment for <strong>{paymentDialog.payment.tenantName}</strong>.
              </p>
              <p style={{ margin: '4px 0 0 0', color: 'var(--dark-text-secondary)', fontSize: '0.9rem' }}>
                Total bill: <strong>₹{paymentDialog.payment.amount.toLocaleString()}</strong>
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Amount Received (₹) *</label>
              <input 
                type="number" 
                min="1" 
                max={paymentDialog.payment.amount}
                className="form-input" 
                value={paymentDialog.amount} 
                onChange={e => setPaymentDialog({...paymentDialog, amount: e.target.value})} 
                required 
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPaymentDialog(null)}>Cancel</button>
              <button type="submit" className="btn btn-success">Save Payment</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
