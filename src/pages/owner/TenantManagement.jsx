import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { Plus, UserMinus, Eye, Edit2, ArrowRightLeft } from 'lucide-react';

export default function TenantManagement() {
  const { currentTenants, currentRooms, currentPayments, addTenant, updateTenant, checkoutTenant, swapTenants } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTenant, setViewTenant] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [editingTenantId, setEditingTenantId] = useState(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapForm, setSwapForm] = useState({ tenant1: '', tenant2: '' });
  const [form, setForm] = useState({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });

  const availableRooms = currentRooms.filter(r => r.status === 'available' || r.status === 'maintenance' || (editingTenantId && r.id === form.roomId));

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate phone number format (exactly 10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(form.phone)) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }

    // Prevent duplicate entries based on phone number
    const duplicate = currentTenants.find(t => t.phone === form.phone && t.isActive !== false && t.id !== editingTenantId);
    if (duplicate) {
      alert(`A tenant with the phone number ${form.phone} already exists (${duplicate.name} in Room ${duplicate.roomNumber}).`);
      return;
    }

    const room = currentRooms.find(r => r.id === form.roomId);
    const tenantData = {
      ...form,
      rentAmount: Number(form.rentAmount) || room?.price || 0,
      securityDeposit: Number(form.securityDeposit) || room?.price || 0,
      roomNumber: room?.number || '',
    };

    if (editingTenantId) {
      updateTenant(editingTenantId, tenantData);
    } else {
      addTenant(tenantData);
    }

    setModalOpen(false);
    setEditingTenantId(null);
    setForm({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });
  };

  const handleCheckout = (tenant) => {
    setCheckoutData(tenant);
  };

  const confirmCheckout = () => {
    if (checkoutData) {
      checkoutTenant(checkoutData.id);
      setCheckoutData(null);
    }
  };

  const unpaidPayments = checkoutData ? currentPayments.filter(p => p.tenantId === checkoutData.id && p.status !== 'paid' && p.status !== 'written_off') : [];
  const totalUnpaid = unpaidPayments.reduce((s, p) => s + p.amount, 0);
  const deposit = checkoutData?.securityDeposit || 0;
  const netBalance = deposit - totalUnpaid;

  const columns = [
    { header: 'Name', accessor: 'name', render: row => <span style={{ fontWeight: 600, color: 'var(--dark-text)' }}>{row.name}</span> },
    { header: 'Room', accessor: 'roomNumber', render: row => <span className="badge badge-primary">Room {row.roomNumber}</span> },
    { header: 'Phone', accessor: 'phone' },
    { header: 'College', accessor: 'college', render: row => <span className="truncate" style={{ maxWidth: '160px', display: 'inline-block' }}>{row.college}</span> },
    { header: 'Year', accessor: 'year' },
    { header: 'Rent', accessor: 'rentAmount', render: row => <span style={{ fontWeight: 600, color: 'var(--success)' }}>₹{row.rentAmount.toLocaleString()}</span> },
    { header: 'Check-in', accessor: 'checkInDate' },
    {
      header: 'Actions', sortable: false,
      render: row => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setViewTenant(row); }} title="View Details">
            <Eye size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} title="Edit Tenant">
            <Edit2 size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleCheckout(row); }} title="Check Out" style={{ color: 'var(--danger)' }}>
            <UserMinus size={16} />
          </button>
        </div>
      )
    },
  ];

  const openAddModal = () => {
    setForm({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });
    setEditingTenantId(null);
    setModalOpen(true);
  };

  const handleEdit = (tenant) => {
    setForm({
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email || '',
      college: tenant.college || '',
      year: tenant.year || '1st Year',
      parentName: tenant.parentName || '',
      parentPhone: tenant.parentPhone || '',
      idProof: tenant.idProof || 'Aadhar Card',
      idNumber: tenant.idNumber || '',
      roomId: tenant.roomId,
      rentAmount: tenant.rentAmount,
      securityDeposit: tenant.securityDeposit,
      checkInDate: tenant.checkInDate
    });
    setEditingTenantId(tenant.id);
    setModalOpen(true);
  };

  const handleSwap = (e) => {
    e.preventDefault();
    if (swapForm.tenant1 === swapForm.tenant2) {
      alert("Please select two different tenants to swap.");
      return;
    }
    swapTenants(swapForm.tenant1, swapForm.tenant2);
    setSwapModalOpen(false);
    setSwapForm({ tenant1: '', tenant2: '' });
  };

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Tenant Management</h1>
        <div className="page-header-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => { setSwapForm({ tenant1: '', tenant2: '' }); setSwapModalOpen(true); }}>
            <ArrowRightLeft size={18} /> Swap Rooms
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Tenant
          </button>
        </div>
      </div>

      <div className="dashboard-card">
        <DataTable columns={columns} data={currentTenants} searchPlaceholder="Search by name, room, phone..." emptyMessage="No tenants found. Add your first tenant!" />
      </div>

      {/* Add/Edit Tenant Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingTenantId ? "Edit Tenant" : "Add New Tenant"} size="lg">
        <form onSubmit={handleSubmit}>
          <h4 style={{ marginBottom: '16px', color: 'var(--primary-light)' }}>Student Details</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Enter student name" />
            </div>
            <div className="form-group">
              <label>Phone Number *</label>
              <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="e.g. 9876543210" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="student@gmail.com" />
            </div>
            <div className="form-group">
              <label>College</label>
              <input className="form-input" value={form.college} onChange={e => setForm({...form, college: e.target.value})} placeholder="College name" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Year</label>
              <select className="form-input" value={form.year} onChange={e => setForm({...form, year: e.target.value})}>
                <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
              </select>
            </div>
            <div className="form-group">
              <label>Check-in Date *</label>
              <input type="date" className="form-input" value={form.checkInDate} onChange={e => setForm({...form, checkInDate: e.target.value})} required />
            </div>
          </div>

          <h4 style={{ marginTop: '24px', marginBottom: '16px', color: 'var(--primary-light)' }}>Parent / Guardian</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Parent Name</label>
              <input className="form-input" value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} placeholder="Parent full name" />
            </div>
            <div className="form-group">
              <label>Parent Phone</label>
              <input className="form-input" value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})} placeholder="Parent phone number" />
            </div>
          </div>

          <h4 style={{ marginTop: '24px', marginBottom: '16px', color: 'var(--primary-light)' }}>ID & Room Assignment</h4>
          <div className="form-row">
            <div className="form-group">
              <label>ID Proof Type</label>
              <select className="form-input" value={form.idProof} onChange={e => setForm({...form, idProof: e.target.value})}>
                <option>Aadhar Card</option><option>College ID</option><option>Passport</option><option>Voter ID</option>
              </select>
            </div>
            <div className="form-group">
              <label>ID Number</label>
              <input className="form-input" value={form.idNumber} onChange={e => setForm({...form, idNumber: e.target.value})} placeholder="ID document number" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Assign Room *</label>
              <select className="form-input" value={form.roomId} onChange={e => {
                const room = currentRooms.find(r => r.id === e.target.value);
                setForm({...form, roomId: e.target.value, rentAmount: room?.price || form.rentAmount });
              }} required>
                <option value="">Select a room</option>
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>Room {r.number} - {r.type} (₹{r.price.toLocaleString()}) [{r.currentOccupants}/{r.capacity}]</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Rent (₹)</label>
              <input type="number" min="0" className="form-input" value={form.rentAmount} onChange={e => setForm({...form, rentAmount: e.target.value})} placeholder="Auto-filled from room" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Security Deposit (₹)</label>
            <input type="number" min="0" className="form-input" value={form.securityDeposit} onChange={e => setForm({...form, securityDeposit: e.target.value})} placeholder="Usually equals one month rent" />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingTenantId ? 'Save Changes' : 'Add Tenant'}</button>
          </div>
        </form>
      </Modal>

      {/* View Tenant Modal */}
      <Modal isOpen={!!viewTenant} onClose={() => setViewTenant(null)} title={viewTenant?.name || 'Tenant Details'} size="md">
        {viewTenant && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                ['Room', `Room ${viewTenant.roomNumber}`],
                ['Phone', viewTenant.phone],
                ['Email', viewTenant.email || 'N/A'],
                ['College', viewTenant.college],
                ['Year', viewTenant.year],
                ['Check-in', viewTenant.checkInDate],
                ['Monthly Rent', `₹${viewTenant.rentAmount.toLocaleString()}`],
                ['Security Deposit', `₹${(viewTenant.securityDeposit || 0).toLocaleString()}`],
                ['Parent', viewTenant.parentName || 'N/A'],
                ['Parent Phone', viewTenant.parentPhone || 'N/A'],
                ['ID Proof', viewTenant.idProof],
                ['ID Number', viewTenant.idNumber || 'N/A'],
              ].map(([label, value], i) => (
                <div key={i}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--dark-text-muted)', display: 'block' }}>{label}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--dark-text)', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={() => { handleCheckout(viewTenant); setViewTenant(null); }}>
                <UserMinus size={16} /> Check Out
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Checkout Settlement Modal */}
      <Modal isOpen={!!checkoutData} onClose={() => setCheckoutData(null)} title="Checkout Settlement" size="md">
        {checkoutData && (
          <div>
            <div style={{ padding: '16px', backgroundColor: 'var(--dark-surface)', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: 'var(--dark-text-muted)' }}>Security Deposit Held:</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>₹{deposit.toLocaleString()}</span>
              </div>
              
              <div style={{ borderTop: '1px solid var(--dark-border)', paddingTop: '12px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--dark-text-muted)', display: 'block', marginBottom: '8px' }}>Unpaid Rent Breakdown:</span>
                {unpaidPayments.length === 0 ? (
                  <div style={{ color: 'var(--dark-text)', fontSize: '0.9rem' }}>No pending or overdue payments.</div>
                ) : (
                  unpaidPayments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--dark-text)' }}>- {p.month} <span style={{ color: p.status === 'overdue' ? 'var(--danger)' : 'var(--warning)', fontSize: '0.8rem' }}>({p.status})</span></span>
                      <span style={{ color: 'var(--dark-text)' }}>₹{p.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--dark-text)' }}>Total Unpaid:</span>
                  <span style={{ color: 'var(--danger)' }}>₹{totalUnpaid.toLocaleString()}</span>
                </div>
              </div>

              <div style={{ borderTop: '2px solid var(--dark-border)', paddingTop: '12px', marginTop: '12px' }}>
                <span style={{ display: 'block', color: 'var(--dark-text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>FINAL SETTLEMENT</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: netBalance > 0 ? 'var(--success)' : netBalance < 0 ? 'var(--danger)' : 'var(--dark-text)' }}>
                  {netBalance > 0 
                    ? `You must refund ₹${netBalance.toLocaleString()} to the student.` 
                    : netBalance < 0 
                    ? `The student still owes you ₹${Math.abs(netBalance).toLocaleString()}.` 
                    : `Accounts are settled. No money is owed.`}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCheckoutData(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmCheckout}>Confirm Checkout</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Swap Rooms Modal */}
      <Modal isOpen={swapModalOpen} onClose={() => setSwapModalOpen(false)} title="Swap Tenant Rooms" size="md">
        <form onSubmit={handleSwap}>
          <div style={{ marginBottom: '16px', color: 'var(--dark-text-secondary)', fontSize: '0.9rem' }}>
            Select two tenants to swap their rooms. Their profiles, rent amounts, and any unpaid bills will be safely exchanged.
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label>Select First Tenant *</label>
            <select className="form-input" value={swapForm.tenant1} onChange={e => setSwapForm({...swapForm, tenant1: e.target.value})} required>
              <option value="">Choose tenant 1</option>
              {currentTenants.map(t => <option key={t.id} value={t.id} disabled={t.id === swapForm.tenant2}>{t.name} (Room {t.roomNumber})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Select Second Tenant *</label>
            <select className="form-input" value={swapForm.tenant2} onChange={e => setSwapForm({...swapForm, tenant2: e.target.value})} required>
              <option value="">Choose tenant 2</option>
              {currentTenants.map(t => <option key={t.id} value={t.id} disabled={t.id === swapForm.tenant1}>{t.name} (Room {t.roomNumber})</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setSwapModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!swapForm.tenant1 || !swapForm.tenant2}>
              <ArrowRightLeft size={16} /> Confirm Swap
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
