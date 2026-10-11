import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, RefreshCw, Mail } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F1123',
      color: '#EEEEF5',
      fontFamily: "'Inter', sans-serif",
      padding: '40px 20px',
      lineHeight: '1.7'
    }}>
      <div style={{
        maxWidth: '840px',
        margin: '0 auto',
        backgroundColor: '#1A1D36',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '40px 36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Back Link */}
        <Link 
          to="/" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#6C5CE7',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '24px'
          }}
        >
          <ArrowLeft size={16} /> Back to AccoHost Home
        </Link>

        {/* Header */}
        <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6C5CE7, #00D2FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Shield size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#fff' }}>Privacy Policy</h1>
              <p style={{ margin: '4px 0 0 0', color: '#9B9BB4', fontSize: '0.85rem' }}>
                AccoHost (https://www.accohost.com) • Last updated: October 11, 2026
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ color: '#D1D1E0', fontSize: '0.95rem' }}>
          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>1. Introduction</h2>
            <p>
              Welcome to <strong>AccoHost</strong> ("we", "our", or "us"). AccoHost provides cloud-based hostel, paying guest (PG), and student accommodation management software accessible at <a href="https://www.accohost.com" style={{ color: '#00D2FF', textDecoration: 'none' }}>https://www.accohost.com</a>. We are committed to protecting your personal data and upholding your right to privacy.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you access or use our platform, including when you authenticate using third-party identity providers such as Google.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>2. Information We Collect</h2>
            <p>We collect information that you directly provide to us, as well as information received through third-party authentication services:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Account & Authentication Information:</strong> When you sign up or log in via Google Sign-In or Magic Link, we collect your <em>name</em>, <em>email address</em>, and <em>profile avatar</em>.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Hostel Management Data:</strong> Information entered by authorized hostel administrators to manage their facilities, including room counts, tenant names, room assignments, phone numbers, and payment records.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Usage & Technical Data:</strong> Basic browser telemetry, IP addresses, and session timestamps required strictly for platform security, fraud prevention, and session maintenance.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>3. How We Use Your Information</h2>
            <p>We use the information we collect solely for legitimate business purposes:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}>To authenticate hostel owners and grant secure access to their private administrative dashboard.</li>
              <li style={{ marginBottom: '8px' }}>To maintain and display accurate tenant rosters, room occupancy, and billing ledgers.</li>
              <li style={{ marginBottom: '8px' }}>To send transactional authentication emails, such as one-time login links (Magic Links).</li>
              <li style={{ marginBottom: '8px' }}>To protect against unauthorized access, fraudulent activity, and security breaches.</li>
            </ul>
            <p style={{ marginTop: '12px', fontWeight: 600, color: '#00C48C' }}>
              ✓ We NEVER sell, rent, trade, or monetize your personal data or your tenants' information to third-party advertisers, data brokers, or marketing networks.
            </p>
          </section>

          {/* Google API Compliance Box */}
          <section style={{
            marginBottom: '28px',
            padding: '20px',
            backgroundColor: 'rgba(108, 92, 231, 0.08)',
            border: '1px solid rgba(108, 92, 231, 0.3)',
            borderRadius: '12px'
          }}>
            <h2 style={{ fontSize: '1.25rem', color: '#A29BFE', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} /> 4. Google API Services User Data Policy Compliance
            </h2>
            <p style={{ margin: 0, lineHeight: '1.8' }}>
              AccoHost's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a 
                href="https://developers.google.com/terms/api-services-user-data-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#00D2FF', textDecoration: 'underline' }}
              >
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
            <p style={{ marginTop: '12px', marginBottom: 0 }}>
              Specifically, Google user data is accessed solely to identify the authorized hostel owner and is never used for serving advertisements, training AI models, or shared with external parties.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>5. Data Storage and Security</h2>
            <p>
              Your data is stored in enterprise-grade cloud databases hosted with <strong>Supabase</strong> (PostgreSQL). We implement industry-standard encryption in transit (HTTPS / TLS 1.3) and at rest (AES-256), strict Row Level Security (RLS) policies, and access controls to ensure that each hostel's data is completely isolated and inaccessible to other organizations.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>6. Data Retention and Deletion</h2>
            <p>
              We retain your information for as long as your account is active and needed to provide you services. If you wish to delete your account, remove your hostel data, or request permanent deletion of all associated tenant records, please contact us at:
            </p>
            <p style={{
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              color: '#00D2FF',
              margin: '12px 0'
            }}>
              chetanchowdarychetan@gmail.com
            </p>
            <p>
              You may also revoke AccoHost's access to your Google account at any time via your{' '}
              <a 
                href="https://myaccount.google.com/permissions" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#00D2FF', textDecoration: 'underline' }}
              >
                Google Account Security Permissions
              </a>.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>7. Contact Us</h2>
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact our administrative team at:</p>
            <p style={{ marginTop: '8px' }}>
              <strong>AccoHost Support Team</strong><br />
              Email: <a href="mailto:chetanchowdarychetan@gmail.com" style={{ color: '#00D2FF' }}>chetanchowdarychetan@gmail.com</a><br />
              Website: <a href="https://www.accohost.com" style={{ color: '#00D2FF' }}>https://www.accohost.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
