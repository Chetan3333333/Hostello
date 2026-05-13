import { Link } from 'react-router-dom';
import { Building2, GraduationCap, BarChart3, Search, ArrowRight, Shield, Users, CreditCard, BedDouble, Star, Smartphone } from 'lucide-react';
import '../styles/landing.css';

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Floating Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <Building2 size={28} />
            <span>Hostello</span>
          </div>
        </div>
      </nav>

      {/* Hero - Role Selector */}
      <section className="role-hero">
        <div className="role-hero-bg">
          <div className="hero-shape shape-1"></div>
          <div className="hero-shape shape-2"></div>
          <div className="hero-shape shape-3"></div>
          <div className="hero-orb orb-1"></div>
          <div className="hero-orb orb-2"></div>
        </div>

        <div className="role-hero-content">
          <div className="hero-badge-glow">
            <span className="hero-badge">🏠 The #1 Hostel Platform Near Mallareddy College</span>
          </div>
          <h1>Welcome to <span className="hero-gradient-text">Hostello</span></h1>
          <p className="role-subtitle">
            The smartest way to find and manage hostels. Choose how you'd like to continue.
          </p>

          <div className="role-cards">
            {/* Owner Card */}
            <Link to="/owner/dashboard" className="role-card role-card-owner">
              <div className="role-card-glow"></div>
              <div className="role-card-content">
                <div className="role-icon-wrapper owner-icon">
                  <Building2 size={32} />
                </div>
                <h2>I'm a Hostel Owner</h2>
                <p>Manage your hostel, track rooms, tenants & payments — all in one powerful dashboard.</p>
                
                <div className="role-features">
                  <div className="role-feature">
                    <BarChart3 size={16} />
                    <span>Revenue Dashboard</span>
                  </div>
                  <div className="role-feature">
                    <BedDouble size={16} />
                    <span>Room Management</span>
                  </div>
                  <div className="role-feature">
                    <Users size={16} />
                    <span>Tenant Tracking</span>
                  </div>
                  <div className="role-feature">
                    <CreditCard size={16} />
                    <span>Payment Records</span>
                  </div>
                </div>

                <div className="role-cta">
                  <span>Open Dashboard</span>
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>

            {/* Student Card */}
            <Link to="/search" className="role-card role-card-student">
              <div className="role-card-glow"></div>
              <div className="role-card-content">
                <div className="role-icon-wrapper student-icon">
                  <GraduationCap size={32} />
                </div>
                <h2>I'm a Student</h2>
                <p>Search hostels near your college, compare prices, check amenities & contact owners directly.</p>
                
                <div className="role-features">
                  <div className="role-feature">
                    <Search size={16} />
                    <span>Smart Search</span>
                  </div>
                  <div className="role-feature">
                    <Star size={16} />
                    <span>Hostel Details</span>
                  </div>
                  <div className="role-feature">
                    <Shield size={16} />
                    <span>Verified Listings</span>
                  </div>
                  <div className="role-feature">
                    <Smartphone size={16} />
                    <span>Direct Contact</span>
                  </div>
                </div>

                <div className="role-cta student-cta">
                  <span>Browse Hostels</span>
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>
          </div>

          {/* Stats */}
          <div className="role-stats">
            <div className="role-stat">
              <span className="role-stat-value">1</span>
              <span className="role-stat-label">Verified Hostel</span>
            </div>
            <div className="role-stat-divider"></div>
            <div className="role-stat">
              <span className="role-stat-value">20</span>
              <span className="role-stat-label">Rooms</span>
            </div>
            <div className="role-stat-divider"></div>
            <div className="role-stat">
              <span className="role-stat-value">Live</span>
              <span className="role-stat-label">Owner Dashboard</span>
            </div>
            <div className="role-stat-divider"></div>
            <div className="role-stat">
              <span className="role-stat-value">24/7</span>
              <span className="role-stat-label">Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="role-footer">
        <div className="role-footer-inner">
          <div className="landing-logo" style={{ fontSize: '1.1rem' }}>
            <Building2 size={20} />
            <span>Hostello</span>
          </div>
          <p>© 2026 Hostello. Built with ❤️ for students & hostel owners near Mallareddy Engineering College.</p>
        </div>
      </footer>
    </div>
  );
}
