import { createContext, useContext, useState, useCallback } from 'react';
import { getInitialData } from '../data/mockData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState(() => getInitialData());

  const saveData = useCallback((newData) => {
    setData(newData);
    localStorage.setItem('hostello_data', JSON.stringify(newData));
  }, []);

  // Auth
  const isOwnerLoggedIn = !!data.ownerAuth;
  const ownerHostelId = data.ownerAuth?.hostelId || null;

  const ownerLogin = useCallback((hostelId, pin) => {
    const hostel = data.hostels.find(h => h.id === hostelId);
    if (!hostel) return { success: false, error: 'Hostel not found' };
    if (hostel.pin !== pin) return { success: false, error: 'Incorrect PIN' };
    const newData = { ...data, ownerAuth: { hostelId, loggedInAt: new Date().toISOString() }, currentHostelId: hostelId };
    saveData(newData);
    return { success: true };
  }, [data, saveData]);

  const ownerLogout = useCallback(() => {
    saveData({ ...data, ownerAuth: null, currentHostelId: null });
  }, [data, saveData]);

  // Derived data — scoped to the single hostel
  const activeHostelId = data.ownerAuth?.hostelId || data.currentHostelId || data.hostels[0]?.id;
  const currentHostel = data.hostels.find(h => h.id === activeHostelId) || data.hostels[0];
  const currentRooms = data.rooms.filter(r => r.hostelId === activeHostelId);
  const currentTenants = data.tenants.filter(t => t.hostelId === activeHostelId && t.isActive);
  const currentPayments = data.payments.filter(p => p.hostelId === activeHostelId);
  const currentStaff = (data.staff || []).filter(s => s.hostelId === activeHostelId);

  const setCurrentHostel = useCallback((hostelId) => {
    saveData({ ...data, currentHostelId: hostelId });
  }, [data, saveData]);

  // Room CRUD
  const addRoom = useCallback((room) => {
    const newRoom = { ...room, id: `${activeHostelId}-r${Date.now()}`, hostelId: activeHostelId };
    saveData({ ...data, rooms: [...data.rooms, newRoom] });
  }, [data, saveData, activeHostelId]);

  const updateRoom = useCallback((roomId, updates) => {
    saveData({ ...data, rooms: data.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r) });
  }, [data, saveData]);

  const deleteRoom = useCallback((roomId) => {
    saveData({ ...data, rooms: data.rooms.filter(r => r.id !== roomId) });
  }, [data, saveData]);

  // Tenant CRUD
  const addTenant = useCallback((tenant) => {
    const newTenant = { ...tenant, id: `t-${Date.now()}`, hostelId: activeHostelId, isActive: true };
    const updatedRooms = data.rooms.map(r => {
      if (r.id === tenant.roomId) {
        return { ...r, currentOccupants: r.currentOccupants + 1, status: 'occupied' };
      }
      return r;
    });
    saveData({ ...data, tenants: [...data.tenants, newTenant], rooms: updatedRooms });
  }, [data, saveData, activeHostelId]);

  const updateTenant = useCallback((tenantId, updates) => {
    saveData({ ...data, tenants: data.tenants.map(t => t.id === tenantId ? { ...t, ...updates } : t) });
  }, [data, saveData]);

  const checkoutTenant = useCallback((tenantId) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    const updatedTenants = data.tenants.map(t => t.id === tenantId ? { ...t, isActive: false, checkOutDate: new Date().toISOString().split('T')[0] } : t);
    const updatedRooms = data.rooms.map(r => {
      if (r.id === tenant.roomId) {
        const newOccupants = Math.max(0, r.currentOccupants - 1);
        return { ...r, currentOccupants: newOccupants, status: newOccupants === 0 ? 'available' : 'occupied' };
      }
      return r;
    });
    saveData({ ...data, tenants: updatedTenants, rooms: updatedRooms });
  }, [data, saveData]);

  // Payment CRUD
  const addPayment = useCallback((payment) => {
    const newPayment = { ...payment, id: `pay-${Date.now()}`, hostelId: activeHostelId };
    saveData({ ...data, payments: [...data.payments, newPayment] });
  }, [data, saveData, activeHostelId]);

  const updatePayment = useCallback((paymentId, updates) => {
    saveData({ ...data, payments: data.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p) });
  }, [data, saveData]);

  const recordPayment = useCallback((paymentId) => {
    saveData({
      ...data,
      payments: data.payments.map(p => p.id === paymentId ? {
        ...p, status: 'paid', paidDate: new Date().toISOString().split('T')[0], method: 'Cash'
      } : p)
    });
  }, [data, saveData]);

  // Hostel Profile
  const updateHostel = useCallback((hostelId, updates) => {
    saveData({ ...data, hostels: data.hostels.map(h => h.id === hostelId ? { ...h, ...updates } : h) });
  }, [data, saveData]);

  // Staff CRUD
  const addStaff = useCallback((staffMember) => {
    const newStaff = { ...staffMember, id: `staff-${Date.now()}`, hostelId: activeHostelId };
    saveData({ ...data, staff: [...(data.staff || []), newStaff] });
  }, [data, saveData, activeHostelId]);

  const updateStaff = useCallback((staffId, updates) => {
    saveData({ ...data, staff: (data.staff || []).map(s => s.id === staffId ? { ...s, ...updates } : s) });
  }, [data, saveData]);

  const deleteStaff = useCallback((staffId) => {
    saveData({ ...data, staff: (data.staff || []).filter(s => s.id !== staffId) });
  }, [data, saveData]);

  // Stats
  const getStats = useCallback(() => {
    const occupied = currentRooms.filter(r => r.status === 'occupied').length;
    const available = currentRooms.filter(r => r.status === 'available').length;
    const maintenance = currentRooms.filter(r => r.status === 'maintenance').length;
    const total = currentRooms.length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthPayments = currentPayments.filter(p => p.month === currentMonth);
    const collected = monthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = monthPayments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0);
    const overdue = currentPayments.filter(p => p.status === 'overdue').length;

    return { total, occupied, available, maintenance, occupancyRate, collected, pending, overdue, totalTenants: currentTenants.length };
  }, [currentRooms, currentPayments, currentTenants]);

  const value = {
    data, currentHostel, currentRooms, currentTenants, currentPayments, currentStaff,
    setCurrentHostel, addRoom, updateRoom, deleteRoom,
    addTenant, updateTenant, checkoutTenant,
    addPayment, updatePayment, recordPayment,
    updateHostel, getStats, hostels: data.hostels,
    // Auth
    isOwnerLoggedIn, ownerHostelId, ownerLogin, ownerLogout,
    // Staff
    addStaff, updateStaff, deleteStaff,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
