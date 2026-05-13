import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState({
    hostels: [],
    rooms: [],
    tenants: [],
    payments: [],
    staff: []
  });
  const [loading, setLoading] = useState(true);
  const [ownerAuth, setOwnerAuth] = useState(() => {
    const saved = localStorage.getItem('hostello_auth');
    return saved ? JSON.parse(saved) : null;
  });

  // Fetch initial data from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        { data: hostelsData },
        { data: roomsData },
        { data: tenantsData },
        { data: paymentsData },
        { data: staffData }
      ] = await Promise.all([
        supabase.from('hostels').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('tenants').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('staff').select('*')
      ]);

      // Convert snake_case back to camelCase for our app to consume
      const mapKeys = (arr) => arr?.map(item => {
        const newObj = {};
        for (let key in item) {
          const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          newObj[camelKey] = item[key];
        }
        return newObj;
      }) || [];

      setData({
        hostels: mapKeys(hostelsData),
        rooms: mapKeys(roomsData),
        tenants: mapKeys(tenantsData),
        payments: mapKeys(paymentsData),
        staff: mapKeys(staffData)
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auth
  const isOwnerLoggedIn = !!ownerAuth;
  const ownerHostelId = ownerAuth?.hostelId || null;

  const ownerLogin = useCallback((hostelId, pin) => {
    const hostel = data.hostels.find(h => h.id === hostelId);
    if (!hostel) return { success: false, error: 'Hostel not found' };
    if (hostel.pin !== pin) return { success: false, error: 'Incorrect PIN' };
    
    const authData = { hostelId, loggedInAt: new Date().toISOString() };
    setOwnerAuth(authData);
    localStorage.setItem('hostello_auth', JSON.stringify(authData));
    return { success: true };
  }, [data.hostels]);

  const ownerLogout = useCallback(() => {
    setOwnerAuth(null);
    localStorage.removeItem('hostello_auth');
  }, []);

  // Derived data — scoped to the single hostel
  const activeHostelId = ownerAuth?.hostelId || data.hostels[0]?.id;
  const currentHostel = data.hostels.find(h => h.id === activeHostelId) || data.hostels[0];
  const currentRooms = data.rooms.filter(r => r.hostelId === activeHostelId);
  const currentTenants = data.tenants.filter(t => t.hostelId === activeHostelId && t.isActive);
  const currentPayments = data.payments.filter(p => p.hostelId === activeHostelId);
  const currentStaff = data.staff.filter(s => s.hostelId === activeHostelId);

  // Helper to convert camelCase to snake_case for Supabase inserts
  const toSnakeCase = (obj) => {
    const newObj = {};
    for (let key in obj) {
      if (key === 'createdAt') continue; // Don't override default timestamp
      if (key === 'hasAC') {
        newObj['has_ac'] = obj[key];
        continue;
      }
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      newObj[snakeKey] = obj[key];
    }
    return newObj;
  };

  // Room CRUD
  const addRoom = useCallback(async (room) => {
    const newRoom = { ...room, id: `${activeHostelId}-r${Date.now()}`, hostelId: activeHostelId };
    try {
      const { error } = await supabase.from('rooms').insert([toSnakeCase(newRoom)]);
      if (error) throw error;
      setData(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
      toast.success('Room added');
    } catch (err) {
      toast.error('Failed to add room');
      console.error(err);
    }
  }, [activeHostelId]);

  const updateRoom = useCallback(async (roomId, updates) => {
    try {
      const { error } = await supabase.from('rooms').update(toSnakeCase(updates)).eq('id', roomId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        rooms: prev.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r)
      }));
      toast.success('Room updated');
    } catch (err) {
      toast.error('Failed to update room');
      console.error(err);
    }
  }, []);

  const deleteRoom = useCallback(async (roomId) => {
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      setData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== roomId) }));
      toast.success('Room deleted');
    } catch (err) {
      toast.error('Failed to delete room');
      console.error(err);
    }
  }, []);

  // Tenant CRUD
  const addTenant = useCallback(async (tenant) => {
    const newTenant = { ...tenant, id: `t-${Date.now()}`, hostelId: activeHostelId, isActive: true };
    const room = currentRooms.find(r => r.id === tenant.roomId);
    
    if (!room) return;
    
    const newOccupants = (room.currentOccupants || 0) + 1;
    const roomUpdates = { currentOccupants: newOccupants, status: 'occupied' };

    try {
      // Execute both queries
      await Promise.all([
        supabase.from('tenants').insert([toSnakeCase(newTenant)]),
        supabase.from('rooms').update(toSnakeCase(roomUpdates)).eq('id', room.id)
      ]);

      setData(prev => ({
        ...prev,
        tenants: [...prev.tenants, newTenant],
        rooms: prev.rooms.map(r => r.id === room.id ? { ...r, ...roomUpdates } : r)
      }));
      toast.success('Tenant added successfully');
    } catch (err) {
      toast.error('Failed to add tenant');
      console.error(err);
    }
  }, [activeHostelId, currentRooms]);

  const updateTenant = useCallback(async (tenantId, updates) => {
    try {
      const { error } = await supabase.from('tenants').update(toSnakeCase(updates)).eq('id', tenantId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        tenants: prev.tenants.map(t => t.id === tenantId ? { ...t, ...updates } : t)
      }));
      toast.success('Tenant updated');
    } catch (err) {
      toast.error('Failed to update tenant');
      console.error(err);
    }
  }, []);

  const checkoutTenant = useCallback(async (tenantId) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    
    const tenantUpdates = { isActive: false, checkOutDate: new Date().toISOString().split('T')[0] };
    const room = currentRooms.find(r => r.id === tenant.roomId);
    
    let roomUpdates = null;
    if (room) {
      const newOccupants = Math.max(0, (room.currentOccupants || 0) - 1);
      roomUpdates = { currentOccupants: newOccupants, status: newOccupants === 0 ? 'available' : 'occupied' };
    }

    try {
      const promises = [supabase.from('tenants').update(toSnakeCase(tenantUpdates)).eq('id', tenantId)];
      if (roomUpdates) {
        promises.push(supabase.from('rooms').update(toSnakeCase(roomUpdates)).eq('id', room.id));
      }
      await Promise.all(promises);

      setData(prev => ({
        ...prev,
        tenants: prev.tenants.map(t => t.id === tenantId ? { ...t, ...tenantUpdates } : t),
        rooms: roomUpdates ? prev.rooms.map(r => r.id === room.id ? { ...r, ...roomUpdates } : r) : prev.rooms
      }));
      toast.success('Tenant checked out');
    } catch (err) {
      toast.error('Failed to checkout tenant');
      console.error(err);
    }
  }, [data.tenants, currentRooms]);

  // Payment CRUD
  const addPayment = useCallback(async (payment) => {
    const newPayment = { ...payment, id: `pay-${Date.now()}`, hostelId: activeHostelId };
    try {
      const { error } = await supabase.from('payments').insert([toSnakeCase(newPayment)]);
      if (error) throw error;
      setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
      toast.success('Payment added');
    } catch (err) {
      toast.error('Failed to add payment');
      console.error(err);
    }
  }, [activeHostelId]);

  const updatePayment = useCallback(async (paymentId, updates) => {
    try {
      const { error } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p)
      }));
      toast.success('Payment updated');
    } catch (err) {
      toast.error('Failed to update payment');
      console.error(err);
    }
  }, []);

  const recordPayment = useCallback(async (paymentId) => {
    const updates = { status: 'paid', paidDate: new Date().toISOString().split('T')[0], method: 'Cash' };
    try {
      const { error } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p)
      }));
      toast.success('Payment recorded');
    } catch (err) {
      toast.error('Failed to record payment');
      console.error(err);
    }
  }, []);

  // Hostel Profile
  const updateHostel = useCallback(async (hostelId, updates) => {
    try {
      const { error } = await supabase.from('hostels').update(toSnakeCase(updates)).eq('id', hostelId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        hostels: prev.hostels.map(h => h.id === hostelId ? { ...h, ...updates } : h)
      }));
      toast.success('Hostel profile updated');
    } catch (err) {
      toast.error('Failed to update hostel profile');
      console.error(err);
    }
  }, []);

  // Staff CRUD
  const addStaff = useCallback(async (staffMember) => {
    const newStaff = { ...staffMember, id: `staff-${Date.now()}`, hostelId: activeHostelId };
    try {
      const { error } = await supabase.from('staff').insert([toSnakeCase(newStaff)]);
      if (error) throw error;
      setData(prev => ({ ...prev, staff: [...prev.staff, newStaff] }));
      toast.success('Staff added');
    } catch (err) {
      toast.error('Failed to add staff');
      console.error(err);
    }
  }, [activeHostelId]);

  const updateStaff = useCallback(async (staffId, updates) => {
    try {
      const { error } = await supabase.from('staff').update(toSnakeCase(updates)).eq('id', staffId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        staff: prev.staff.map(s => s.id === staffId ? { ...s, ...updates } : s)
      }));
      toast.success('Staff updated');
    } catch (err) {
      toast.error('Failed to update staff');
      console.error(err);
    }
  }, []);

  const deleteStaff = useCallback(async (staffId) => {
    try {
      const { error } = await supabase.from('staff').delete().eq('id', staffId);
      if (error) throw error;
      setData(prev => ({ ...prev, staff: prev.staff.filter(s => s.id !== staffId) }));
      toast.success('Staff deleted');
    } catch (err) {
      toast.error('Failed to delete staff');
      console.error(err);
    }
  }, []);

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
    data, loading, currentHostel, currentRooms, currentTenants, currentPayments, currentStaff,
    addRoom, updateRoom, deleteRoom,
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
