import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import { useApp } from './hooks/useApp';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const OwnerLogin = lazy(() => import('./pages/owner/OwnerLogin'));
const OwnerLayout = lazy(() => import('./pages/owner/OwnerLayout'));
const Dashboard = lazy(() => import('./pages/owner/Dashboard'));
const RoomManagement = lazy(() => import('./pages/owner/RoomManagement'));
const TenantManagement = lazy(() => import('./pages/owner/TenantManagement'));
const PaymentTracking = lazy(() => import('./pages/owner/PaymentTracking'));
const StaffManagement = lazy(() => import('./pages/owner/StaffManagement'));
const HostelProfile = lazy(() => import('./pages/owner/HostelProfile'));
const HostelSearch = lazy(() => import('./pages/student/HostelSearch'));
const HostelDetail = lazy(() => import('./pages/student/HostelDetail'));

const RouteLoading = () => (
  <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
    Loading Hostello...
  </div>
);

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
        <Suspense fallback={<RouteLoading />}>
          <AppRoutes />
        </Suspense>
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
