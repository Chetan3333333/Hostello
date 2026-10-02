import { useState, useEffect } from 'react';
import { useApp } from '../../hooks/useApp';
import StatCard from '../../components/StatCard';
import { BedDouble, Users, DoorOpen, IndianRupee, AlertTriangle, TrendingUp, UserPlus, CreditCard, Wrench, UserCog, Clock, Settings, Search } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';

function getRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((new Date() - date) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1A1D36', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ color: '#EEEEF5', fontSize: '0.8125rem', fontWeight: 600 }}>₹{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
}

const ACTIVITY_PAGE_SIZE = 100;

export default function Dashboard() {
  const { getStats, currentPayments, data, hasMoreActivityLogs, loadingMoreActivityLogs, loadMoreActivityLogs, searchActivityLogs } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const stats = getStats();
  const activityLogs = data.activityLogs || [];

  // When the owner searches or asks for warnings only, the database is asked
  // across the whole history instead of filtering the lines already downloaded.
  const isSearchMode = Boolean(searchTerm.trim()) || warningsOnly;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!isSearchMode) {
        if (active) {
          setSearchResults([]);
          setSearchHasMore(false);
          setSearchFailed(false);
          setSearching(false);
        }
        return;
      }
      if (active) {
        setSearching(true);
        setSearchFailed(false);
      }
      try {
        const rows = await searchActivityLogs({ search: searchTerm, warningsOnly });
        if (!active) return;
        setSearchResults(rows);
        setSearchHasMore(rows.length === ACTIVITY_PAGE_SIZE);
      } catch (err) {
        console.error('Activity search failed:', err);
        if (active) {
          setSearchResults([]);
          setSearchFailed(true);
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [searchTerm, warningsOnly, isSearchMode, searchActivityLogs]);

  const loadMoreSearchResults = async () => {
    const last = searchResults[searchResults.length - 1];
    if (!last) return;
    setSearching(true);
    try {
      const rows = await searchActivityLogs({
        search: searchTerm,
        warningsOnly,
        before: { createdAt: last.createdAt, id: last.id }
      });
      setSearchResults(prev => [...prev, ...rows]);
      setSearchHasMore(rows.length === ACTIVITY_PAGE_SIZE);
    } catch (err) {
      console.error('Loading more search results failed:', err);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const filteredLogs = isSearchMode ? searchResults : activityLogs;

  // Occupancy pie data
  const occupancyData = [
    { name: 'Occupied', value: stats.occupied, color: '#00D2FF' },
    { name: 'Available', value: stats.available, color: '#00C48C' },
    { name: 'Maintenance', value: stats.maintenance, color: '#FFB547' },
  ].filter(d => d.value > 0);

  // Revenue trend (last 6 months dynamically)
  const now = new Date();
  const months = [];
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('default', { month: 'short' }));
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const revenueTrend = months.map((month, i) => {
    const paid = currentPayments.filter(p => p.month === monthKeys[i] && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    return { month, revenue: paid };
  });

  // Removed old scraping method

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger-children">
        <StatCard icon={BedDouble} label="Total Rooms" value={stats.total} color="primary" />
        <StatCard icon={DoorOpen} label="Occupied" value={stats.occupied} color="accent" />
        <StatCard icon={BedDouble} label="Available" value={stats.available} color="success" />
        <StatCard icon={Users} label="Total Tenants" value={stats.totalTenants} color="primary" />
        <StatCard icon={IndianRupee} label="Collected (This Month)" value={`₹${stats.collected.toLocaleString()}`} color="success" />
        <StatCard icon={Clock} label="Pending (This Month)" value={`₹${stats.pending.toLocaleString()}`} color="warning" />
        <StatCard icon={AlertTriangle} label="Total Outstanding" value={`₹${stats.totalOutstanding.toLocaleString()}`} color={stats.totalOutstanding > 0 ? 'danger' : 'success'} />
      </div>

      <div className="dashboard-grid">
        {/* Revenue Chart */}
        <div className="dashboard-card" style={{ animationDelay: '200ms' }}>
          <div className="dashboard-card-header">
            <h3>Revenue Trend</h3>
            <span className="badge badge-success">
              <TrendingUp size={12} /> Last 6 months
            </span>
          </div>
          <div className="chart-container" style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B6B80', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B6B80', fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#6C5CE7" strokeWidth={2.5} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occupancy Chart */}
        <div className="dashboard-card" style={{ animationDelay: '300ms' }}>
          <div className="dashboard-card-header">
            <h3>Occupancy</h3>
            <span className="badge badge-primary">{stats.occupancyRate}%</span>
          </div>
          <div className="chart-container" style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {occupancyData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} rooms`, name]} contentStyle={{ background: '#1A1D36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8125rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
            {occupancyData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#9B9BB4' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }}></div>
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card" style={{ animationDelay: '400ms' }}>
          <div className="dashboard-card-header" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Audit & Recent Activity</h3>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button 
                  onClick={() => setWarningsOnly(false)}
                  style={{
                    background: !warningsOnly ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: !warningsOnly ? '#fff' : '#6B6B80',
                    border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: !warningsOnly ? 600 : 400
                  }}
                >
                  All Events
                </button>
                <button 
                  onClick={() => setWarningsOnly(true)}
                  style={{
                    background: warningsOnly ? 'var(--danger)' : 'transparent',
                    color: warningsOnly ? '#fff' : '#6B6B80',
                    border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: warningsOnly ? 600 : 400,
                    boxShadow: warningsOnly ? '0 2px 8px rgba(255, 71, 87, 0.4)' : 'none'
                  }}
                >
                  <AlertTriangle size={12} />
                  Warnings
                </button>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dark-text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search audit logs by tenant, room, or action..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff', fontSize: '0.875rem' }}
              />
            </div>
          </div>
          <div className="activity-feed" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px', marginTop: '16px' }}>
            {isSearchMode && (
              <p style={{ color: 'var(--dark-text-muted)', fontSize: '0.75rem', padding: '4px 0 8px' }}>
                {searching
                  ? 'Searching the full history...'
                  : searchFailed
                    ? 'Could not search right now. Please try again.'
                    : `Searching the full history · ${filteredLogs.length}${searchHasMore ? '+' : ''} match${filteredLogs.length === 1 ? '' : 'es'}`}
              </p>
            )}
            {filteredLogs.length === 0 ? (
              <p style={{ color: 'var(--dark-text-muted)', textAlign: 'center', padding: '20px' }}>
                {searching ? 'Searching...' : 'No matching activity logs'}
              </p>
            ) : (
              filteredLogs.map((act, i) => {
                let Icon = Settings;
                let dotColor = 'primary';
                let label = 'System';
                
                if (act.type === 'payment') {
                  Icon = IndianRupee;
                  if (act.message.toLowerCase().includes('overdue')) dotColor = 'danger';
                  else if (act.message.toLowerCase().includes('undone') || act.message.toLowerCase().includes('written off')) dotColor = 'warning';
                  else dotColor = 'success';
                  label = 'Payment';
                } else if (act.type === 'tenant') {
                  Icon = Users;
                  dotColor = 'accent';
                  label = 'Tenant';
                } else if (act.type === 'room') {
                  Icon = Wrench;
                  dotColor = 'warning';
                  label = 'Room';
                } else if (act.type === 'staff') {
                  // The Staff section was removed, but older log entries of this type stay readable.
                  Icon = UserCog;
                  dotColor = 'primary';
                  label = 'Staff';
                }

                // Global override for ANY security warning
                if (act.message.includes('WARNING:')) {
                  dotColor = 'danger';
                  if (act.type === 'system') {
                    label = 'Alert';
                    Icon = AlertTriangle;
                  }
                }

                return (
                  <div className="activity-item" key={act.id || i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className={`bg-${dotColor}`} style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: `var(--${dotColor})`, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className={`badge badge-${dotColor}`} style={{ fontSize: '0.65rem', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                        <span style={{ fontSize: '0.75rem', color: '#9B9BB4' }}>
                          {getRelativeTime(act.createdAt || act.created_at)} · {act.actorType === 'owner' ? 'Owner' : 'Automated'}
                        </span>
                      </div>
                      <div className="activity-text" style={{ fontSize: '0.875rem', color: '#EEEEF5', lineHeight: '1.5' }}>{act.message}</div>
                    </div>
                  </div>
                );
              })
            )}
            {isSearchMode && searchHasMore && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadMoreSearchResults}
                disabled={searching}
                style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
              >
                <Clock size={14} />
                {searching ? 'Loading...' : 'Load more matches'}
              </button>
            )}
            {hasMoreActivityLogs && !isSearchMode && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadMoreActivityLogs}
                disabled={loadingMoreActivityLogs}
                style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
              >
                <Clock size={14} />
                {loadingMoreActivityLogs ? 'Loading...' : 'Load earlier activity'}
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card" style={{ animationDelay: '500ms' }}>
          <div className="dashboard-card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <Link to="/owner/tenants" className="quick-action-btn">
              <UserPlus size={20} /> Add New Tenant
            </Link>
            <Link to="/owner/payments" className="quick-action-btn">
              <CreditCard size={20} /> Record Payment
            </Link>
            <Link to="/owner/rooms" className="quick-action-btn">
              <Wrench size={20} /> Manage Rooms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
