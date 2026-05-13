import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock, Eye, EyeOff, ArrowLeft, Shield, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../hooks/useApp';
import '../../styles/owner.css';

export default function OwnerLogin() {
  const { ownerLogin, isOwnerLoggedIn, loading: contextLoading } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOwnerLoggedIn && !contextLoading) {
      navigate('/owner/dashboard', { replace: true });
    }
  }, [contextLoading, isOwnerLoggedIn, navigate]);

  if (contextLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>Loading Hostello Data...</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your owner email');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    const result = await ownerLogin(email.trim(), password);
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
      <div className="login-bg-shapes">
        <div className="login-shape shape-1"></div>
        <div className="login-shape shape-2"></div>
        <div className="login-shape shape-3"></div>
      </div>

      <div className="login-container">
        <button className="login-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Back to Home
        </button>

        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">
              <Building2 size={28} />
            </div>
            <h1>Hostello</h1>
            <p>Owner Dashboard</p>
          </div>

          <div className="login-security-badge">
            <Shield size={14} />
            <span>Supabase Auth Protected</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label>Owner Email</label>
              <div className="login-input-wrapper">
                <Mail size={18} className="login-field-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="owner@example.com"
                  className="login-input"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter your password"
                  className="login-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

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

          <div className="login-hint">
            <p>Create the owner email/password in Supabase Auth, then map that user to the hostel using the SQL setup file.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
