import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './pages/LandingPage';
import OwnerLogin from './pages/owner/OwnerLogin';
import OwnerLayout from './pages/owner/OwnerLayout';
import Dashboard from './pages/owner/Dashboard';
import RoomManagement from './pages/owner/RoomManagement';
import TenantManagement from './pages/owner/TenantManagement';
import PaymentTracking from './pages/owner/PaymentTracking';
import StaffManagement from './pages/owner/StaffManagement';
import HostelProfile from './pages/owner/HostelProfile';
import HostelSearch from './pages/student/HostelSearch';
import HostelDetail from './pages/student/HostelDetail';

function ProtectedOwnerRoute({ children }) {
  const { isOwnerLoggedIn, loading } = useApp();
  
  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>Loading Hostello Data...</div>;
  }
  if (!isOwnerLoggedIn) {
    return <Navigate to="/owner/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/search" element={<HostelSearch />} />
      <Route path="/hostel/:id" element={<HostelDetail />} />

      {/* Owner Login */}
      <Route path="/owner/login" element={<OwnerLogin />} />

      {/* Owner Dashboard (Protected) */}
      <Route path="/owner" element={
        <ProtectedOwnerRoute>
          <OwnerLayout />
        </ProtectedOwnerRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="rooms" element={<RoomManagement />} />
        <Route path="tenants" element={<TenantManagement />} />
        <Route path="payments" element={<PaymentTracking />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="profile" element={<HostelProfile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1A1D36',
            color: '#EEEEF5',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          success: { iconTheme: { primary: '#00C48C', secondary: '#1A1D36' } },
          error: { iconTheme: { primary: '#FF6B6B', secondary: '#1A1D36' } },
        }}
      />
    </AppProvider>
  );
}
