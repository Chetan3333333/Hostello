import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, MapPin, ArrowRight, Building2 } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { amenityLabels } from '../../data/mockData';
import '../../styles/student.css';

const getMinPrice = (pricing) => {
  const prices = Object.values(pricing || {}).map(Number).filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : null;
};

// Same rule as the hostel page: the cheapest real room wins, and the hostel's
// own pricing field is only a fallback.
const buildStartingPrices = (hostels, rooms) => {
  const byHostel = new Map();
  (rooms || []).forEach(r => {
    if (r.isArchived) return;
    const price = Number(r.price);
    if (!Number.isFinite(price)) return;
    const current = byHostel.get(r.hostelId);
    if (current === undefined || price < current) byHostel.set(r.hostelId, price);
  });
  const result = new Map();
  (hostels || []).forEach(h => {
    result.set(h.id, byHostel.has(h.id) ? byHostel.get(h.id) : getMinPrice(h.pricing));
  });
  return result;
};

export default function HostelSearch() {
  const { data } = useApp();
  const startingPrices = useMemo(
    () => buildStartingPrices(data.hostels, data.rooms),
    [data.hostels, data.rooms]
  );
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState([0, 15000]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [amenityFilter, setAmenityFilter] = useState([]);
  const [sortBy, setSortBy] = useState('price-low');
  const [showFilters, setShowFilters] = useState(false);

  const hostels = useMemo(() => {
    let result = [...data.hostels];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(h =>
        (h.name || '').toLowerCase().includes(q)
        || (h.address || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') result = result.filter(h => h.type === typeFilter);
    result = result.filter(h => {
      const minPrice = startingPrices.get(h.id) ?? null;
      return minPrice === null || (minPrice >= priceRange[0] && minPrice <= priceRange[1]);
    });
    if (amenityFilter.length > 0) {
      result = result.filter(h => amenityFilter.every(a => (h.amenities || []).includes(a)));
    }

    if (sortBy === 'price-low') result.sort((a, b) => (startingPrices.get(a.id) ?? Infinity) - (startingPrices.get(b.id) ?? Infinity));
    else if (sortBy === 'price-high') result.sort((a, b) => {
      const aPrice = startingPrices.get(a.id) ?? null;
      const bPrice = startingPrices.get(b.id) ?? null;
      if (aPrice === null) return 1;
      if (bPrice === null) return -1;
      return bPrice - aPrice;
    });

    return result;
  }, [data.hostels, search, typeFilter, priceRange, amenityFilter, sortBy, startingPrices]);

  const toggleAmenity = (a) => {
    setAmenityFilter(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  return (
    <div className="student-page">
      <nav className="student-nav">
        <div className="student-nav-inner">
          <Link to="/" className="landing-logo">
            <Building2 size={24} /> <span>Hostello</span>
          </Link>
          <Link to="/" className="btn btn-outline" style={{ borderColor: 'var(--light-border)', color: 'var(--light-text)' }}>← Home</Link>
        </div>
      </nav>

      <div className="search-hero">
        <h1>Find Your Perfect Hostel</h1>
        <p>Browse hostels near Mallareddy Engineering College</p>
        <div className="search-bar-large">
          <Search size={20} />
          <input type="text" placeholder="Search by hostel name or location..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="search-content">
        {showFilters && (
          <div className="filter-panel animate-slide-up">
            <div className="filter-panel-header">
              <h3>Filters</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setTypeFilter('all'); setAmenityFilter([]); setPriceRange([0, 15000]); }}>
                Clear All
              </button>
            </div>
            <div className="filter-section">
              <h4>Hostel Type</h4>
              <div className="filter-chips">
                {['all', 'boys', 'girls', 'co-ed'].map(t => (
                  <button key={t} className={`filter-chip-light ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>
                    {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <h4>Max Price: ₹{priceRange[1].toLocaleString()}/mo</h4>
              <input type="range" min="2000" max="15000" step="500" value={priceRange[1]} onChange={e => setPriceRange([0, Number(e.target.value)])} className="price-slider" />
            </div>
            <div className="filter-section">
              <h4>Amenities</h4>
              <div className="filter-chips">
                {Object.entries(amenityLabels).slice(0, 10).map(([key, { label }]) => (
                  <button key={key} className={`filter-chip-light ${amenityFilter.includes(key) ? 'active' : ''}`} onClick={() => toggleAmenity(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="search-results-header">
          <span className="results-count">Showing {hostels.length} hostel{hostels.length !== 1 ? 's' : ''}</span>
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        <div className="search-results-grid">
          {hostels.map(hostel => {
            const rooms = data.rooms.filter(r => r.hostelId === hostel.id && !r.isArchived);
            const available = rooms.filter(r => r.status === 'available').length;
            return (
              <Link to={`/hostel/${hostel.id}`} className="hostel-search-card" key={hostel.id}>
                <div className="hostel-search-image">
                  <div className="hostel-preview-placeholder">
                    <Building2 size={36} />
                  </div>
                  <span className={`hostel-type-badge-light ${hostel.type}`}>
                    {hostel.type === 'boys' ? '♂ Boys' : hostel.type === 'girls' ? '♀ Girls' : '⚥ Co-ed'}
                  </span>
                  {available > 0 && <span className="availability-badge">{available} rooms available</span>}
                </div>
                <div className="hostel-search-info">
                  <div className="hostel-search-top">
                    <h3>{hostel.name}</h3>
                  </div>
                  <p className="hostel-search-location"><MapPin size={14} /> {hostel.nearbyLandmarks?.[0] || hostel.address?.split(',')[0] || 'Location not provided'}</p>
                  <div className="hostel-search-amenities">
                    {(hostel.amenities || []).slice(0, 5).map(a => (
                      <span key={a} className="amenity-tag-light">{amenityLabels[a]?.label || a}</span>
                    ))}
                  </div>
                  <div className="hostel-search-bottom">
                    <div>
                      <span className="price-from">Starting from</span>
                      {(startingPrices.get(hostel.id) ?? null) === null
                        ? <span className="price-amount">Price on request</span>
                        : <span className="price-amount">₹{startingPrices.get(hostel.id).toLocaleString()}<span className="price-period">/month</span></span>}
                    </div>
                    <span className="view-details-btn">View Details <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {hostels.length === 0 && (
          <div className="no-results">
            <Search size={48} />
            <h3>No hostels found</h3>
            <p>Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
