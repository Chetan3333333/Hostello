import { useParams, Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import { Building2, MapPin, Star, Phone, MessageCircle, Mail, ArrowLeft, Shield, Check } from 'lucide-react';
import { amenityLabels, roomTypeLabels } from '../../data/mockData';
import '../../styles/student.css';

const getMinPrice = (pricing) => {
  const prices = Object.values(pricing || {}).map(Number).filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : null;
};

export default function HostelDetail() {
  const { id } = useParams();
  const { data } = useApp();
  const hostel = data.hostels.find(h => h.id === id);
  const rooms = data.rooms.filter(r => r.hostelId === id && !r.isArchived);
  const minPrice = getMinPrice(hostel?.pricing);

  if (!hostel) {
    return (
      <div className="student-page">
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <h2>Hostel not found</h2>
          <Link to="/search" className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Search</Link>
        </div>
      </div>
    );
  }

  const availableRooms = rooms.filter(r => r.status === 'available').length;
  const roomTypes = {};
  rooms.forEach(r => {
    if (!roomTypes[r.type]) roomTypes[r.type] = { type: r.type, price: r.price, total: 0, available: 0 };
    roomTypes[r.type].total++;
    if (r.status === 'available') roomTypes[r.type].available++;
  });

  return (
    <div className="student-page">
      <nav className="student-nav">
        <div className="student-nav-inner">
          <Link to="/" className="landing-logo"><Building2 size={24} /> <span>Hostello</span></Link>
          <Link to="/search" className="btn btn-outline" style={{ borderColor: 'var(--light-border)', color: 'var(--light-text)' }}>
            <ArrowLeft size={16} /> Back to Search
          </Link>
        </div>
      </nav>

      <div className="detail-hero">
        <div className="detail-hero-image">
          <div className="hostel-preview-placeholder" style={{ height: '100%', minHeight: '300px', borderRadius: 'var(--radius-lg)' }}>
            <Building2 size={64} />
          </div>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-main">
          {/* Header */}
          <div className="detail-header animate-slide-up">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span className={`hostel-type-badge-light ${hostel.type}`}>
                  {hostel.type === 'boys' ? '♂ Boys' : hostel.type === 'girls' ? '♀ Girls' : '⚥ Co-ed'}
                </span>
                <div className="hostel-search-rating"><Star size={16} fill="#FFB547" color="#FFB547" /> {hostel.rating || 'New'}</div>
              </div>
              <h1>{hostel.name}</h1>
              <p className="detail-location"><MapPin size={16} /> {hostel.address || 'Location not provided'}</p>
              {hostel.nearbyLandmarks && hostel.nearbyLandmarks.length > 0 && (
                <div className="detail-landmarks">
                  {hostel.nearbyLandmarks.slice(0, 3).map((lm, i) => (
                    <span key={i} className="detail-landmark-tag"><MapPin size={12} /> {lm}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="detail-section animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2>About</h2>
            <p className="detail-description">{hostel.description || 'Description not provided yet.'}</p>
          </div>

          {/* Amenities */}
          <div className="detail-section animate-slide-up" style={{ animationDelay: '150ms' }}>
            <h2>Amenities</h2>
            <div className="detail-amenities-grid">
              {(hostel.amenities || []).map(a => (
                <div key={a} className="detail-amenity">
                  <Check size={16} style={{ color: 'var(--success)' }} />
                  <span>{amenityLabels[a]?.label || a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Room Types */}
          <div className="detail-section animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2>Rooms & Pricing</h2>
            <div className="room-types-grid">
              {Object.values(roomTypes).map(rt => (
                <div key={rt.type} className="room-type-card">
                  <div className="room-type-header">
                    <h3>{roomTypeLabels[rt.type] || rt.type}</h3>
                    <span className={`badge ${rt.available > 0 ? 'badge-success' : 'badge-danger'}`}>
                      {rt.available > 0 ? `${rt.available} available` : 'Full'}
                    </span>
                  </div>
                  <div className="room-type-price">₹{Number(rt.price || 0).toLocaleString()}<span>/month</span></div>
                  <div className="room-type-total">{rt.total} total rooms</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rules */}
          {hostel.rules && (
            <div className="detail-section animate-slide-up" style={{ animationDelay: '250ms' }}>
              <h2>Rules & Policies</h2>
              <div className="detail-rules">
                {hostel.rules.split('\n').map((rule, i) => (
                  <div key={i} className="rule-item">
                    <Shield size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Contact */}
        <div className="detail-sidebar animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="contact-card">
            <h3>Contact This Hostel</h3>
            <div className="contact-price-range">
              <span className="price-from">Starting from</span>
              <span className="contact-price">
                {minPrice === null ? 'Price on request' : <>₹{minPrice.toLocaleString()}<span>/month</span></>}
              </span>
            </div>
            <div className="contact-availability">
              <span className={availableRooms > 0 ? 'text-success' : 'text-danger'}>
                {availableRooms > 0 ? `${availableRooms} rooms available` : 'Currently full'}
              </span>
            </div>
            <div className="contact-actions">
              {hostel.phone && (
                <a href={`tel:${hostel.phone}`} className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                  <Phone size={18} /> Call Now
                </a>
              )}
              {hostel.whatsapp && (
                <a href={`https://wa.me/91${hostel.whatsapp}?text=Hi, I found your hostel on Hostello. I'm interested in booking a room.`} target="_blank" rel="noreferrer" className="btn btn-success btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                  <MessageCircle size={18} /> WhatsApp
                </a>
              )}
              {hostel.email && (
                <a href={`mailto:${hostel.email}`} className="btn btn-outline btn-lg" style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--light-border)', color: 'var(--light-text)' }}>
                  <Mail size={18} /> Email
                </a>
              )}
            </div>
            <div className="contact-info-items">
              {hostel.phone && (
                <div className="contact-info-item">
                  <Phone size={14} /> <span>{hostel.phone}</span>
                </div>
              )}
              {hostel.email && (
                <div className="contact-info-item">
                  <Mail size={14} /> <span>{hostel.email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
