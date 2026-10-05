import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BedDouble, Users, CreditCard, Building2, Menu, X, Bell, LogOut } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { useState } from 'react';
import toast from 'react-hot-toast';
import '../../styles/owner.css';

const navItems = [
  { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/owner/rooms', icon: BedDouble, label: 'Rooms' },
  { to: '/owner/tenants', icon: Users, label: 'Tenants' },
  { to: '/owner/payments', icon: CreditCard, label: 'Payments' },
  { to: '/owner/profile', icon: Building2, label: 'Profile' },
];

export default function OwnerLayout() {
  const { currentHostel, ownerLogout, loadError, retryLoad } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await ownerLogout();
    toast.success('Logged out successfully');
    navigate('/owner/login', { replace: true });
  };

  return (
    <div className="owner-layout">
      {/* Sidebar */}
      <aside className={`owner-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Building2 size={24} />
            <span>Hostello</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Hostel Info (read-only) */}
        <div className="hostel-info-badge">
          <div className="hostel-info-avatar">
            {currentHostel?.name?.charAt(0)}
          </div>
          <div className="hostel-info-details">
            <span className="hostel-info-name">{currentHostel?.name}</span>
            <span className="hostel-info-type">{currentHostel?.type} hostel</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/" className="sidebar-link">
            <Building2 size={20} />
            <span>Back to Home</span>
          </NavLink>
          <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="owner-main">
        <header className="owner-topbar">
          <button className="topbar-menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="topbar-title">
            <h2>{currentHostel?.name}</h2>
          </div>
          <div className="topbar-actions">
            <div className="topbar-avatar">
              {currentHostel?.name?.charAt(0)}
            </div>
          </div>
        </header>
        <div className="owner-content">
          {loadError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
            }}>
              <span>Could not load your latest data. You are still signed in.</span>
              <button className="btn btn-sm" onClick={retryLoad}>Retry</button>
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
