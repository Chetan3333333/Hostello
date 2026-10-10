import { useState } from 'react';
import toast from 'react-hot-toast';
import { Save, MapPin } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { amenityLabels } from '../../data/mockData';

function HostelProfileForm({ currentHostel, updateHostel }) {
  const [form, setForm] = useState({ ...currentHostel });

  // Only the fields this form actually shows are sent. The room count is kept
  // accurate by the database, so it must never be written back from a copy the
  // screen took when it opened.
  const EDITABLE_FIELDS = [
    'name', 'type', 'address', 'phone', 'whatsapp', 'email',
    'description', 'nearbyLandmarks', 'amenities', 'rules', 'established',
    'isPublished'
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!(form.name || '').trim()) {
      toast.error('Hostel name is required');
      return;
    }
    const updates = {};
    EDITABLE_FIELDS.forEach(field => {
      if (form[field] !== undefined) updates[field] = form[field];
    });
    updates.name = form.name.trim();
    await updateHostel(currentHostel.id, updates);
  };

  const toggleAmenity = (amenity) => {
    const currentAmenities = form.amenities || [];
    const amenities = currentAmenities.includes(amenity)
      ? currentAmenities.filter(a => a !== amenity)
      : [...currentAmenities, amenity];
    setForm({ ...form, amenities });
  };

  const landmarksText = (form.nearbyLandmarks || []).join('\n');
  const handleLandmarksChange = (text) => {
    setForm({ ...form, nearbyLandmarks: text.split('\n').filter(line => line.trim() !== '' || text.endsWith('\n')) });
  };

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Hostel Profile</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="profile-section">
          <h3>Public Listing</h3>
          <label
            className={`amenity-checkbox ${form.isPublished ? 'checked' : ''}`}
            style={{
              borderColor: form.isPublished ? 'var(--success)' : '',
              backgroundColor: form.isPublished ? 'rgba(0, 196, 140, 0.1)' : ''
            }}
          >
            <input
              type="checkbox"
              checked={!!form.isPublished}
              onChange={e => setForm({ ...form, isPublished: e.target.checked })}
            />
            <span style={{ color: form.isPublished ? 'var(--success)' : 'inherit' }}>
              Show this hostel to students on the public website
            </span>
          </label>
          <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {form.isPublished
              ? 'Students can find this hostel in search and see its rooms, prices and contact details.'
              : 'This hostel is hidden from students. Nobody can find it in search or open its page. Your own dashboard is not affected.'}
          </p>
        </div>

        <div className="profile-section">
          <h3>Basic Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Hostel Name</label>
              <input className="form-input" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select className="form-input" value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="co-ed">Co-ed</option>
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Address</label>
            <input className="form-input" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <input className="form-input" value={form.whatsapp || ''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Email</label>
            <input type="email" className="form-input" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Description</label>
            <textarea className="form-input" rows="4" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div className="profile-section">
          <h3><MapPin size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />Nearby Colleges & Landmarks</h3>
          <div className="form-group">
            <label>List nearby colleges, landmarks, and distances (one per line)</label>
            <textarea
              className="form-input"
              rows="6"
              value={landmarksText}
              onChange={e => handleLandmarksChange(e.target.value)}
              style={{ resize: 'vertical' }}
              placeholder={`e.g.\nMallareddy Engineering College - 200m\nMallareddy Institute of Technology - 500m\nMaisammaguda Bus Stop - 150m\nApollo Pharmacy - 100m`}
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--dark-text-muted)', marginTop: '8px' }}>
            Add one landmark per line with approximate distance. This helps students find your hostel easily.
          </p>
        </div>

        <div className="profile-section">
          <h3>Amenities</h3>
          <div className="amenities-grid">
            {Object.entries(amenityLabels).map(([key, { label }]) => (
              <label key={key} className={`amenity-checkbox ${form.amenities?.includes(key) ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.amenities?.includes(key) || false} onChange={() => toggleAmenity(key)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h3>Rules & Policies</h3>
          <div className="form-group">
            <label>Hostel Rules (one per line)</label>
            <textarea className="form-input" rows="6" value={form.rules || ''} onChange={e => setForm({ ...form, rules: e.target.value })} style={{ resize: 'vertical' }} />
          </div>
        </div>
      </form>
    </div>
  );
}

export default function HostelProfile() {
  const { currentHostel, updateHostel } = useApp();

  if (!currentHostel) {
    return <div style={{ color: 'var(--dark-text-muted)', padding: '32px' }}>Loading hostel profile...</div>;
  }

  return <HostelProfileForm key={currentHostel.id} currentHostel={currentHostel} updateHostel={updateHostel} />;
}
