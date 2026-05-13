import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Building2, Lock, Eye, EyeOff, ArrowLeft, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../styles/owner.css';

export default function OwnerLogin() {
  const { hostels, ownerLogin, isOwnerLoggedIn, loading: contextLoading } = useApp();
  const navigate = useNavigate();
  const [selectedHostel, setSelectedHostel] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect
  if (isOwnerLoggedIn && !contextLoading) {
    navigate('/owner/dashboard', { replace: true });
    return null;
  }

  if (contextLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>Loading Hostello Data...</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!selectedHostel) {
      setError('Please select your hostel');
      return;
    }
    if (!pin) {
      setError('Please enter your PIN');
      return;
    }

    setLoading(true);
    
    // Simulate a slight delay for realism
    await new Promise(r => setTimeout(r, 600));

    const result = ownerLogin(selectedHostel, pin);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome back!');
      navigate('/owner/dashboard', { replace: true });
    } else {
      setError(result.error || 'Login failed');
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div className="owner-login-page">
      {/* Animated background */}
      <div className="login-bg-shapes">
        <div className="login-shape shape-1"></div>
        <div className="login-shape shape-2"></div>
        <div className="login-shape shape-3"></div>
      </div>

      <div className="login-container">
        {/* Back to home */}
        <button className="login-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Back to Home
        </button>

        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <Building2 size={28} />
            </div>
            <h1>Hostello</h1>
            <p>Owner Dashboard</p>
          </div>

          {/* Security badge */}
          <div className="login-security-badge">
            <Shield size={14} />
            <span>Secure Owner Access</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Hostel Selection */}
            <div className="login-field">
              <label>Select Your Hostel</label>
              <div className="login-select-wrapper">
                <Building2 size={18} className="login-field-icon" />
                <select
                  value={selectedHostel}
                  onChange={(e) => { setSelectedHostel(e.target.value); setError(''); }}
                  className="login-input"
                >
                  <option value="">Choose your hostel...</option>
                  {hostels.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* PIN Entry */}
            <div className="login-field">
              <label>Enter PIN</label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-field-icon" />
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setError(''); }}
                  placeholder="Enter your 4-digit PIN"
                  maxLength={4}
                  className="login-input"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={`login-submit ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner"></span>
              ) : (
                <>
                  <Lock size={18} />
                  Access Dashboard
                </>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="login-hint">
            <p>Demo PINs for testing:</p>
            <div className="login-hint-pins">
              {hostels.map(h => (
                <button
                  key={h.id}
                  className="login-hint-chip"
                  onClick={() => { setSelectedHostel(h.id); setPin(h.pin); }}
                >
                  {h.name.split(' ').slice(0, 2).join(' ')} → <strong>{h.pin}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
