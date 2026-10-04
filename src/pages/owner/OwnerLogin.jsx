import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Shield, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../../hooks/useApp';
import { supabase } from '../../lib/supabase';
import '../../styles/owner.css';

export default function OwnerLogin() {
  const { isOwnerLoggedIn, loading: contextLoading } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOwnerLoggedIn && !contextLoading) {
      navigate('/owner/dashboard', { replace: true });
    }
  }, [contextLoading, isOwnerLoggedIn, navigate]);

  if (contextLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>Loading Hostello Data...</div>;
  }

  const handleGoogleLogin = async () => {
    setError('');
    setLoadingGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/owner/dashboard'
        }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Failed to initialize Google login');
      toast.error(err.message || 'Failed to initialize Google login');
      setLoadingGoogle(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your owner email');
      return;
    }

    setLoadingMagic(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin + '/owner/dashboard',
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast.success('Magic link sent! Check your email.');
    } catch (err) {
      setError(err.message || 'Failed to send magic link');
      toast.error(err.message || 'Failed to send magic link');
    } finally {
      setLoadingMagic(false);
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
            <p>Owner Access</p>
          </div>

          <div className="login-security-badge" style={{ marginBottom: '24px' }}>
            <Shield size={14} />
            <span>Invite-Only Secure Access</span>
          </div>

          <button 
            type="button"
            className={`login-submit ${loadingGoogle ? 'loading' : ''}`}
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loadingMagic}
            style={{ backgroundColor: '#fff', color: '#000', marginBottom: '20px' }}
          >
            {loadingGoogle ? (
              <span className="login-spinner" style={{ borderTopColor: '#000' }}></span>
            ) : (
              <>
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
            <span style={{ fontSize: '0.8rem', color: '#9B9BB4', textTransform: 'uppercase', letterSpacing: '1px' }}>Or</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          {magicLinkSent ? (
            <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(0, 196, 140, 0.1)', borderRadius: '12px', border: '1px solid rgba(0, 196, 140, 0.2)' }}>
              <div style={{ color: '#00C48C', marginBottom: '12px' }}>
                <Mail size={32} style={{ margin: '0 auto' }} />
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>Check your email</h3>
              <p style={{ color: '#EEEEF5', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                We've sent a magic link to <strong>{email}</strong>. Click the link to instantly sign in.
              </p>
              <button 
                type="button" 
                onClick={() => setMagicLinkSent(false)}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: '16px' }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="login-form">
              <div className="login-field">
                <label>Sign in with Magic Link</label>
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

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={`login-submit ${loadingMagic ? 'loading' : ''}`}
                disabled={loadingMagic || loadingGoogle}
              >
                {loadingMagic ? (
                  <span className="login-spinner"></span>
                ) : (
                  <>
                    <Mail size={18} />
                    Send Magic Link
                  </>
                )}
              </button>
            </form>
          )}

          <div className="login-hint" style={{ marginTop: '24px' }}>
            <p>Access is invite-only. If you haven't received an invitation, you won't be able to log in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
