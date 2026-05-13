import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { Plus, UserMinus, Eye, Users } from 'lucide-react';

export default function TenantManagement() {
  const { currentTenants, currentRooms, addTenant, checkoutTenant } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTenant, setViewTenant] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });

  const availableRooms = currentRooms.filter(r => r.status === 'available' || (r.status === 'occupied' && r.currentOccupants < r.capacity));

  const handleSubmit = (e) => {
    e.preventDefault();
    const room = currentRooms.find(r => r.id === form.roomId);
    addTenant({
      ...form,
      rentAmount: Number(form.rentAmount) || room?.price || 0,
      securityDeposit: Number(form.securityDeposit) || room?.price || 0,
      roomNumber: room?.number || '',
    });
    setModalOpen(false);
    setForm({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });
  };

  const handleCheckout = (tenant) => {
    if (confirm(`Check out ${tenant.name} from Room ${tenant.roomNumber}?`)) {
      checkoutTenant(tenant.id);
    }
  };

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
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleCheckout(row); }} title="Check Out" style={{ color: 'var(--danger)' }}>
            <UserMinus size={16} />
          </button>
        </div>
      )
    },
  ];

  const openAddModal = () => {
    setForm({ name: '', phone: '', email: '', college: '', year: '1st Year', parentName: '', parentPhone: '', idProof: 'Aadhar Card', idNumber: '', roomId: '', rentAmount: '', securityDeposit: '', checkInDate: new Date().toISOString().split('T')[0] });
    setModalOpen(true);
  };

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Tenant Management</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Tenant
          </button>
        </div>
      </div>

      <div className="dashboard-card">
        <DataTable columns={columns} data={currentTenants} searchPlaceholder="Search by name, room, phone..." emptyMessage="No tenants found. Add your first tenant!" />
      </div>

      {/* Add Tenant Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New Tenant" size="lg">
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
              <input type="number" className="form-input" value={form.rentAmount} onChange={e => setForm({...form, rentAmount: e.target.value})} placeholder="Auto-filled from room" />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Security Deposit (₹)</label>
            <input type="number" className="form-input" value={form.securityDeposit} onChange={e => setForm({...form, securityDeposit: e.target.value})} placeholder="Usually equals one month rent" />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Tenant</button>
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
    </div>
  );
}
