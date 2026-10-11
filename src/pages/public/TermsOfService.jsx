import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export default function TermsOfService() {
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
              <FileText size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#fff' }}>Terms of Service</h1>
              <p style={{ margin: '4px 0 0 0', color: '#9B9BB4', fontSize: '0.85rem' }}>
                AccoHost (https://www.accohost.com) • Last updated: October 11, 2026
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ color: '#D1D1E0', fontSize: '0.95rem' }}>
          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>1. Agreement to Terms</h2>
            <p>
              By accessing or using <strong>AccoHost</strong> at <a href="https://www.accohost.com" style={{ color: '#00D2FF', textDecoration: 'none' }}>https://www.accohost.com</a> (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>2. Description of Service</h2>
            <p>
              AccoHost is a software-as-a-service (SaaS) platform designed for hostel owners, PG operators, and accommodation managers to manage their rooms, track tenant bookings, record rent payments, and manage property profiles.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>3. User Accounts & Responsibilities</h2>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Account Security:</strong> You are responsible for safeguarding your login credentials (including Magic Link access and Google accounts). You must immediately notify us of any unauthorized use of your account.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Data Accuracy:</strong> You agree that all property, tenant, room pricing, and billing information entered into the platform is accurate and lawful.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Authorized Use:</strong> Access to owner administrative dashboards is invite-only. You agree not to attempt to bypass access controls or access another hostel's data.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>4. Acceptable Use Policy</h2>
            <p>You agree not to use AccoHost to:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}>Violate any applicable national or international laws or regulations.</li>
              <li style={{ marginBottom: '8px' }}>Store or transmit fraudulent or misleading billing statements.</li>
              <li style={{ marginBottom: '8px' }}>Attempt to probe, scan, or compromise the vulnerability of any AccoHost system or network.</li>
              <li style={{ marginBottom: '8px' }}>Reverse engineer or decompile any aspect of the software platform.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>5. Intellectual Property</h2>
            <p>
              The Service, including its original source code, user interfaces, branding, diamond logo, and features, remains the exclusive intellectual property of AccoHost. You retain full ownership of all tenant and property data that you submit to the Service.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account immediately, without prior notice, if you breach these Terms. Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>7. Disclaimer & Limitation of Liability</h2>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis. While AccoHost utilizes automated enterprise cloud infrastructure and security controls, we do not warrant that the Service will be uninterrupted or error-free. In no event shall AccoHost be liable for any indirect, incidental, or consequential damages resulting from your use of the platform.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>8. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. When updates are published, the revised date at the top of this page will be updated. Your continued use of the platform following any modifications constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 700, marginBottom: '12px' }}>9. Contact Us</h2>
            <p>For questions or notices regarding these Terms, please contact:</p>
            <p style={{ marginTop: '8px' }}>
              <strong>AccoHost Legal & Administrative Team</strong><br />
              Email: <a href="mailto:chetanchowdarychetan@gmail.com" style={{ color: '#00D2FF' }}>chetanchowdarychetan@gmail.com</a><br />
              Website: <a href="https://www.accohost.com" style={{ color: '#00D2FF' }}>https://www.accohost.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
