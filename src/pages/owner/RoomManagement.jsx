import { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import Modal from '../../components/Modal';
import { Plus, Trash2, BedDouble } from 'lucide-react';
import { roomTypeLabels } from '../../data/mockData';

export default function RoomManagement() {
  const { currentRooms, addRoom, updateRoom, deleteRoom } = useApp();
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [form, setForm] = useState({ number: '', floor: 1, type: '3_sharing', price: '', status: 'available', hasAttachedBath: false, hasAC: false });

  const filters = [
    { key: 'all', label: `All (${currentRooms.length})` },
    { key: 'occupied', label: `Occupied (${currentRooms.filter(r => r.status === 'occupied').length})` },
    { key: 'available', label: `Available (${currentRooms.filter(r => r.status === 'available').length})` },
    { key: 'maintenance', label: `Maintenance (${currentRooms.filter(r => r.status === 'maintenance').length})` },
  ];

  const filteredRooms = filter === 'all' ? currentRooms : currentRooms.filter(r => r.status === filter);
  const floors = [...new Set(currentRooms.map(r => r.floor))].sort();

  const getCapacityFromType = (type) => {
    const num = parseInt(type.charAt(0));
    return isNaN(num) ? 3 : num;
  };

  const openAddModal = () => {
    setEditingRoom(null);
    setForm({ number: '', floor: 1, type: '3_sharing', price: '', status: 'available', hasAttachedBath: false, hasAC: false });
    setModalOpen(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);
    setForm({ number: room.number, floor: room.floor, type: room.type, price: room.price, status: room.status, hasAttachedBath: room.hasAttachedBath, hasAC: room.hasAC });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const capacity = getCapacityFromType(form.type);
    const roomData = {
      ...form,
      price: Number(form.price),
      floor: Number(form.floor),
      capacity: capacity,
      currentOccupants: editingRoom ? editingRoom.currentOccupants : 0,
    };
    if (editingRoom) {
      updateRoom(editingRoom.id, roomData);
    } else {
      addRoom(roomData);
    }
    setModalOpen(false);
  };

  const handleDelete = (room) => {
    if (room.status === 'occupied') {
      alert('Cannot delete an occupied room. Please check out tenants first.');
      return;
    }
    if (confirm(`Delete Room ${room.number}?`)) deleteRoom(room.id);
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
              <input type="number" className="form-input" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} required min="1" />
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
              <input type="number" className="form-input" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required placeholder="e.g. 4500" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label>Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <label className={`amenity-checkbox ${form.hasAttachedBath ? 'checked' : ''}`}>
              <input type="checkbox" checked={form.hasAttachedBath} onChange={e => setForm({...form, hasAttachedBath: e.target.checked})} />
              Attached Bathroom
            </label>
            <label className={`amenity-checkbox ${form.hasAC ? 'checked' : ''}`}>
              <input type="checkbox" checked={form.hasAC} onChange={e => setForm({...form, hasAC: e.target.checked})} />
              AC Room
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            {editingRoom && editingRoom.status !== 'occupied' && (
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
    </div>
  );
}
