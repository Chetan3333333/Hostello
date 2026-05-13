import { useApp } from '../../context/AppContext';
import StatCard from '../../components/StatCard';
import { BedDouble, Users, DoorOpen, IndianRupee, AlertTriangle, TrendingUp, UserPlus, CreditCard, Wrench, UserCog } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { getStats, currentPayments, currentTenants, currentRooms } = useApp();
  const stats = getStats();

  // Occupancy pie data
  const occupancyData = [
    { name: 'Occupied', value: stats.occupied, color: '#00D2FF' },
    { name: 'Available', value: stats.available, color: '#00C48C' },
    { name: 'Maintenance', value: stats.maintenance, color: '#FFB547' },
  ].filter(d => d.value > 0);

  // Revenue trend (last 6 months)
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const monthKeys = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
  const revenueTrend = months.map((month, i) => {
    const paid = currentPayments.filter(p => p.month === monthKeys[i] && p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);
    return { month, revenue: paid };
  });

  // Recent activity from payments and tenants
  const recentActivities = [
    ...currentPayments.filter(p => p.status === 'paid').slice(-3).map(p => ({
      text: `₹${p.amount.toLocaleString()} received from ${p.tenantName}`,
      time: p.paidDate,
      color: 'green',
    })),
    ...currentPayments.filter(p => p.status === 'overdue').slice(0, 2).map(p => ({
      text: `Payment overdue: ${p.tenantName} - Room ${p.roomNumber}`,
      time: p.dueDate,
      color: 'red',
    })),
    ...currentTenants.slice(-2).map(t => ({
      text: `${t.name} checked in to Room ${t.roomNumber}`,
      time: t.checkInDate,
      color: 'blue',
    })),
  ].sort((a, b) => b.time?.localeCompare(a.time)).slice(0, 6);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#1A1D36', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#EEEEF5', fontSize: '0.8125rem', fontWeight: 600 }}>₹{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

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
        <StatCard icon={AlertTriangle} label="Pending" value={`₹${stats.pending.toLocaleString()}`} color={stats.pending > 0 ? 'danger' : 'success'} />
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
          <div className="dashboard-card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="activity-feed">
            {recentActivities.length === 0 ? (
              <p style={{ color: 'var(--dark-text-muted)', textAlign: 'center', padding: '20px' }}>No recent activity</p>
            ) : (
              recentActivities.map((act, i) => (
                <div className="activity-item" key={i}>
                  <div className={`activity-dot ${act.color}`}></div>
                  <div>
                    <div className="activity-text">{act.text}</div>
                    <div className="activity-time">{act.time}</div>
                  </div>
                </div>
              ))
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
            <Link to="/owner/staff" className="quick-action-btn">
              <UserCog size={20} /> Manage Staff
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
