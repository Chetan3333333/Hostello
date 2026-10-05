import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import Modal from '../../components/Modal';
import { Plus, Trash2, BedDouble, Snowflake, ShowerHead, Wrench } from 'lucide-react';
import { roomTypeLabels } from '../../data/mockData';

export default function RoomManagement() {
  const { currentRooms, addRoom, updateRoom, deleteRoom } = useApp();
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [form, setForm] = useState({ number: '', floor: 1, type: '3_sharing', price: '', isMaintenance: false, maintenanceNotes: '', hasAttachedBath: false, hasAc: false });

  const filters = [
    { key: 'all', label: `All (${currentRooms.length})` },
    { key: 'occupied', label: `Occupied (${currentRooms.filter(r => r.status === 'occupied').length})` },
    { key: 'available', label: `Available (${currentRooms.filter(r => r.status === 'available').length})` },
    { key: 'maintenance', label: `Maintenance (${currentRooms.filter(r => r.status === 'maintenance').length})` },
  ];

  const filteredRooms = filter === 'all' ? currentRooms : currentRooms.filter(r => r.status === filter);
  const floors = [...new Set(currentRooms.map(r => r.floor))].sort();

  const getCapacityFromType = (type) => {
    const num = parseInt(type.split('_')[0]);
    return isNaN(num) ? 3 : num;
  };

  const openAddModal = () => {
    setEditingRoom(null);
    setForm({ number: '', floor: 1, type: '3_sharing', price: '', isMaintenance: false, maintenanceNotes: '', hasAttachedBath: false, hasAc: false });
    setModalOpen(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setForm({ number: room.number, floor: room.floor, type: room.type, price: room.price, isMaintenance: room.status === 'maintenance', maintenanceNotes: room.maintenanceNotes || '', hasAttachedBath: room.hasAttachedBath, hasAc: room.hasAc });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const capacity = getCapacityFromType(form.type);
    const currentOccupants = editingRoom ? editingRoom.currentOccupants : 0;

    // Bug 2 Fix: Duplicate room number check
    const normalizedNumber = form.number.trim();
    const duplicate = currentRooms.find(r => r.number.trim().toLowerCase() === normalizedNumber.toLowerCase() && (!editingRoom || r.id !== editingRoom.id));
    if (duplicate) {
      alert(`Room ${form.number} already exists! Please use a different room number.`);
      return;
    }

    // Suggestion 1 Fix: Capacity change protection
    if (editingRoom && capacity < currentOccupants) {
      alert(`This room currently has ${currentOccupants} occupants. You cannot convert it to ${roomTypeLabels[form.type]} until you move at least ${currentOccupants - capacity} student(s) out.`);
      return;
    }
    
    // Auto-calculate correct status based purely on occupancy math and maintenance override
    let finalStatus = form.isMaintenance ? 'maintenance' : (currentOccupants >= capacity ? 'occupied' : 'available');

    const roomData = {
      ...form,
      number: normalizedNumber,
      price: Number(form.price),
      floor: Number(form.floor),
      capacity: capacity,
      currentOccupants: currentOccupants,
      status: finalStatus
    };
    delete roomData.isMaintenance; // clean up before sending to DB
    const success = editingRoom
      ? await updateRoom(editingRoom.id, roomData)
      : await addRoom(roomData);
    if (!success) return;
    setModalOpen(false);
  };

  const handleDelete = (room) => {
    if (room.currentOccupants > 0) {
      alert('Cannot delete a room that has occupants. Please check out or move tenants first.');
      return;
    }
    setConfirmDialog({
      title: 'Delete Room',
      message: `Delete Room ${room.number}?`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: () => {
        deleteRoom(room.id);
        setConfirmDialog(null);
      }
    });
  };

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Room Management</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={18} /> Add Room
          </button>
        </div>
      </div>

      <div className="room-filters">
        {filters.map(f => (
          <button key={f.key} className={`filter-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {floors.map(floor => {
        const floorRooms = filteredRooms.filter(r => r.floor === floor);
        if (floorRooms.length === 0) return null;
        return (
          <div key={floor} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--dark-text-muted)', marginBottom: '12px', fontWeight: 600 }}>
              Floor {floor}
            </h3>
            <div className="room-grid">
              {floorRooms.map(room => (
                <div key={room.id} className={`room-card ${room.status}`} onClick={() => openEditModal(room)}>
                  <div className={`room-status-dot ${room.status}`}></div>
                  <div className="room-number">{room.number}</div>
                  <div className="room-type">{roomTypeLabels[room.type] || room.type}</div>
                  <div className="room-price">₹{room.price.toLocaleString()}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--dark-text-muted)', marginTop: '4px' }}>
                    {room.currentOccupants}/{room.capacity} occupants
                  </div>
                  {(room.hasAc || room.hasAttachedBath || (room.status === 'maintenance' && room.maintenanceNotes)) && (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '6px' }}>
                      {room.hasAc && <Snowflake size={13} style={{ color: 'var(--accent)', opacity: 0.8 }} title="AC Room" />}
                      {room.hasAttachedBath && <ShowerHead size={13} style={{ color: 'var(--primary-light)', opacity: 0.8 }} title="Attached Bathroom" />}
                      {room.status === 'maintenance' && room.maintenanceNotes && <Wrench size={13} style={{ color: 'var(--warning)', opacity: 0.8 }} title={`Maintenance Notes:\n${room.maintenanceNotes}`} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filteredRooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--dark-text-muted)' }}>
          <BedDouble size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>No rooms found</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingRoom ? `Edit Room ${editingRoom.number}` : 'Add New Room'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Room Number</label>
              <input className="form-input" value={form.number} onChange={e => setForm({...form, number: e.target.value})} required placeholder="e.g. 201" />
            </div>
            <div className="form-group">
              <label>Floor</label>
              <input type="number" className="form-input" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} required min="0" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Room Type (Sharing)</label>
              <select className="form-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {Object.entries(roomTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Rent (₹)</label>
              <input type="number" min="0" className="form-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required placeholder="e.g. 4500" />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <label className={`amenity-checkbox ${form.isMaintenance ? 'checked' : ''}`} style={{ borderColor: form.isMaintenance ? 'var(--warning)' : '', backgroundColor: form.isMaintenance ? 'rgba(234, 179, 8, 0.1)' : '' }}>
              <input type="checkbox" checked={form.isMaintenance} onChange={e => setForm({...form, isMaintenance: e.target.checked})} />
              <span style={{ color: form.isMaintenance ? 'var(--warning)' : 'inherit' }}>Mark room as under maintenance</span>
            </label>
            {form.isMaintenance && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <textarea className="form-input" rows="2" placeholder="List any repairs needed (e.g., Broken AC, Leaking pipe)" value={form.maintenanceNotes} onChange={e => setForm({...form, maintenanceNotes: e.target.value})} style={{ borderColor: 'rgba(234, 179, 8, 0.3)', backgroundColor: 'rgba(234, 179, 8, 0.05)' }}></textarea>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <label className={`amenity-checkbox ${form.hasAttachedBath ? 'checked' : ''}`}>
              <input type="checkbox" checked={form.hasAttachedBath} onChange={e => setForm({...form, hasAttachedBath: e.target.checked})} />
              Attached Bathroom
            </label>
            <label className={`amenity-checkbox ${form.hasAc ? 'checked' : ''}`}>
              <input type="checkbox" checked={form.hasAc} onChange={e => setForm({...form, hasAc: e.target.checked})} />
              AC Room
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            {editingRoom && editingRoom.currentOccupants === 0 && (
              <button type="button" className="btn btn-danger" onClick={() => { handleDelete(editingRoom); setModalOpen(false); }}>
                <Trash2 size={16} /> Delete
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editingRoom ? 'Save Changes' : 'Add Room'}
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
