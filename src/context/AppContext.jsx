import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { AppContext } from './app-context';

const emptyData = {
  hostels: [],
  rooms: [],
  tenants: [],
  payments: [],
  staff: []
};

const mapKeys = (arr) => arr?.map(item => {
  const newObj = {};
  for (const key in item) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = item[key];
  }
  return newObj;
}) || [];

const toSnakeCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    if (key === 'createdAt') continue;
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

export const calculateRoomStatus = (occupants, capacity, isMaintenance) => {
  if (isMaintenance) return 'maintenance';
  if (occupants >= capacity) return 'occupied';
  return 'available';
};

export function AppProvider({ children }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);

  const fetchPublicData = useCallback(async () => {
    const [{ data: hostelsData, error: hostelsError }, { data: roomsData, error: roomsError }] = await Promise.all([
      supabase.from('hostels').select('id,name,type,address,phone,whatsapp,email,description,nearby_landmarks,rating,total_rooms,amenities,rules,pricing,established,created_at'),
      supabase.from('rooms').select('*')
    ]);

    if (hostelsError) throw hostelsError;
    if (roomsError) throw roomsError;

    setData(prev => ({
      ...prev,
      hostels: mapKeys(hostelsData),
      rooms: mapKeys(roomsData)
    }));
  }, []);

  const clearOwnerData = useCallback(() => {
    setOwnerProfile(null);
    setData(prev => ({
      ...prev,
      tenants: [],
      payments: [],
      staff: []
    }));
  }, []);

  const fetchOwnerData = useCallback(async (userId) => {
    const { data: profileData, error: profileError } = await supabase
      .from('owner_profiles')
      .select('hostel_id')
      .eq('user_id', userId)
      .single();

    if (profileError) throw profileError;

    const hostelId = profileData.hostel_id;
    const [
      { data: hostelData, error: hostelError },
      { data: roomsData, error: roomsError },
      { data: tenantsData, error: tenantsError },
      { data: paymentsData, error: paymentsError },
      { data: staffData, error: staffError }
    ] = await Promise.all([
      supabase.from('hostels').select('*').eq('id', hostelId).single(),
      supabase.from('rooms').select('*').eq('hostel_id', hostelId),
      supabase.from('tenants').select('*').eq('hostel_id', hostelId),
      supabase.from('payments').select('*').eq('hostel_id', hostelId),
      supabase.from('staff').select('*').eq('hostel_id', hostelId)
    ]);

    const firstError = hostelError || roomsError || tenantsError || paymentsError || staffError;
    if (firstError) throw firstError;

    const mappedHostel = mapKeys([hostelData])[0];
    setOwnerProfile({ userId, hostelId });
    
    // Auto-Overdue Logic: Check for pending bills where due date has passed
    let mappedPayments = mapKeys(paymentsData);
    const todayStr = new Date().toISOString().split('T')[0];
    const newlyOverdue = mappedPayments.filter(p => p.status === 'pending' && p.dueDate && p.dueDate < todayStr);
    
    if (newlyOverdue.length > 0) {
      mappedPayments = mappedPayments.map(p => 
        (p.status === 'pending' && p.dueDate && p.dueDate < todayStr) ? { ...p, status: 'overdue' } : p
      );
      
      const overdueIds = newlyOverdue.map(p => p.id);
      // Fire-and-forget DB update
      supabase.from('payments')
        .update({ status: 'overdue' })
        .in('id', overdueIds)
        .then(({ error }) => {
          if (error) console.error('Failed to auto-update overdue status', error);
        });
    }

    setData(prev => ({
      hostels: [
        ...prev.hostels.filter(h => h.id !== hostelId),
        mappedHostel
      ],
      rooms: [
        ...prev.rooms.filter(r => r.hostelId !== hostelId),
        ...mapKeys(roomsData)
      ],
      tenants: mapKeys(tenantsData),
      payments: mappedPayments,
      staff: mapKeys(staffData)
    }));
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      try {
        const [{ data: authData }] = await Promise.all([
          supabase.auth.getSession(),
          fetchPublicData()
        ]);

        if (!isActive) return;

        const initialSession = authData.session;
        setSession(initialSession);

        if (initialSession) {
          await fetchOwnerData(initialSession.user.id);
        } else {
          clearOwnerData();
        }
      } catch (error) {
        console.error('Error loading Hostello data:', error);
        toast.error('Failed to load data from database');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadInitialData();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession) {
        clearOwnerData();
        return;
      }

      const loadOwner = async () => {
        try {
          await fetchOwnerData(nextSession.user.id);
        } catch (error) {
          console.error('Error loading owner data:', error);
          toast.error('Owner account is not linked to a hostel yet');
          await supabase.auth.signOut();
          clearOwnerData();
        }
      };

      loadOwner();
    });

    return () => {
      isActive = false;
      listener.subscription.unsubscribe();
    };
  }, [clearOwnerData, fetchOwnerData, fetchPublicData]);

  const isOwnerLoggedIn = !!session && !!ownerProfile;
  const ownerHostelId = ownerProfile?.hostelId || null;

  const ownerLogin = useCallback(async (email, password) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    try {
      await fetchOwnerData(authData.user.id);
      return { success: true };
    } catch (profileError) {
      await supabase.auth.signOut();
      clearOwnerData();
      return {
        success: false,
        error: profileError.message || 'This owner account is not linked to a hostel'
      };
    }
  }, [clearOwnerData, fetchOwnerData]);

  const ownerLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    clearOwnerData();
  }, [clearOwnerData]);

  const activeHostelId = ownerHostelId || data.hostels[0]?.id;
  const currentHostel = data.hostels.find(h => h.id === activeHostelId) || data.hostels[0];
  const currentRooms = data.rooms.filter(r => r.hostelId === activeHostelId);
  const currentTenants = data.tenants.filter(t => t.hostelId === activeHostelId && t.isActive);
  const currentPayments = data.payments.filter(p => p.hostelId === activeHostelId);
  const currentStaff = data.staff.filter(s => s.hostelId === activeHostelId);

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
      if (err?.code === '23503') {
        toast.error('Cannot delete: This room has past tenants linked to it. Please rename it or mark it as maintenance instead.');
      } else {
        toast.error('Failed to delete room');
        console.error(err);
      }
    }
  }, []);

  const addTenant = useCallback(async (tenant) => {
    const newTenant = { ...tenant, id: `t-${Date.now()}`, hostelId: activeHostelId, isActive: true };
    const room = currentRooms.find(r => r.id === tenant.roomId);

    if (!room) return;

    const newOccupants = (room.currentOccupants || 0) + 1;
    const roomUpdates = { 
      currentOccupants: newOccupants, 
      status: calculateRoomStatus(newOccupants, room.capacity, room.status === 'maintenance') 
    };

    try {
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
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    let promises = [];
    let stateUpdates = { rooms: null, paymentUpdates: null };

    // Check if room is changing
    const isRoomChanging = updates.roomId && updates.roomId !== tenant.roomId;
    if (isRoomChanging) {
      const oldRoom = currentRooms.find(r => r.id === tenant.roomId);
      const newRoom = currentRooms.find(r => r.id === updates.roomId);

      if (oldRoom && newRoom) {
        const oldOccupants = Math.max(0, (oldRoom.currentOccupants || 0) - 1);
        const oldRoomUpdates = { 
          currentOccupants: oldOccupants, 
          status: calculateRoomStatus(oldOccupants, oldRoom.capacity, oldRoom.status === 'maintenance') 
        };
        
        const newOccupants = (newRoom.currentOccupants || 0) + 1;
        const newRoomUpdates = { 
          currentOccupants: newOccupants, 
          status: calculateRoomStatus(newOccupants, newRoom.capacity, newRoom.status === 'maintenance') 
        };

        promises.push(supabase.from('rooms').update(toSnakeCase(oldRoomUpdates)).eq('id', oldRoom.id));
        promises.push(supabase.from('rooms').update(toSnakeCase(newRoomUpdates)).eq('id', newRoom.id));

        stateUpdates.rooms = {
          old: { id: oldRoom.id, updates: oldRoomUpdates },
          new: { id: newRoom.id, updates: newRoomUpdates }
        };

        // Sync pending/overdue payments with new room number
        const newRoomNumber = updates.roomNumber || newRoom.number;
        const paymentSyncUpdates = { roomNumber: newRoomNumber };
        promises.push(
          supabase.from('payments')
            .update(toSnakeCase(paymentSyncUpdates))
            .eq('tenant_id', tenantId)
            .in('status', ['pending', 'overdue'])
        );
        stateUpdates.paymentUpdates = { tenantId, roomNumber: newRoomNumber };
      }
    }

    promises.push(supabase.from('tenants').update(toSnakeCase(updates)).eq('id', tenantId));

    try {
      await Promise.all(promises);
      
      setData(prev => {
        let nextRooms = prev.rooms;
        if (stateUpdates.rooms) {
          nextRooms = nextRooms.map(r => {
            if (r.id === stateUpdates.rooms.old.id) return { ...r, ...stateUpdates.rooms.old.updates };
            if (r.id === stateUpdates.rooms.new.id) return { ...r, ...stateUpdates.rooms.new.updates };
            return r;
          });
        }
        let nextPayments = prev.payments;
        if (stateUpdates.paymentUpdates) {
          nextPayments = nextPayments.map(p => {
            if (p.tenantId === stateUpdates.paymentUpdates.tenantId && p.status !== 'paid') {
              return { ...p, roomNumber: stateUpdates.paymentUpdates.roomNumber };
            }
            return p;
          });
        }
        return {
          ...prev,
          tenants: prev.tenants.map(t => t.id === tenantId ? { ...t, ...updates } : t),
          rooms: nextRooms,
          payments: nextPayments
        };
      });
      toast.success('Tenant updated');
    } catch (err) {
      toast.error('Failed to update tenant');
      console.error(err);
    }
  }, [data.tenants, currentRooms]);

  const swapTenants = useCallback(async (tenantAId, tenantBId) => {
    const tenantA = data.tenants.find(t => t.id === tenantAId);
    const tenantB = data.tenants.find(t => t.id === tenantBId);
    
    if (!tenantA || !tenantB) return;

    // The logic: Tenant A gets B's room and rent. Tenant B gets A's room and rent.
    const aUpdates = { roomId: tenantB.roomId, roomNumber: tenantB.roomNumber, rentAmount: tenantB.rentAmount };
    const bUpdates = { roomId: tenantA.roomId, roomNumber: tenantA.roomNumber, rentAmount: tenantA.rentAmount };
    
    // Sync payment updates (Pending/Overdue only)
    const aPaymentUpdates = { room_number: tenantB.roomNumber, amount: tenantB.rentAmount };
    const bPaymentUpdates = { room_number: tenantA.roomNumber, amount: tenantA.rentAmount };

    try {
      const promises = [
        supabase.from('tenants').update(toSnakeCase(aUpdates)).eq('id', tenantA.id),
        supabase.from('tenants').update(toSnakeCase(bUpdates)).eq('id', tenantB.id),
        supabase.from('payments').update(aPaymentUpdates).eq('tenant_id', tenantA.id).in('status', ['pending', 'overdue']),
        supabase.from('payments').update(bPaymentUpdates).eq('tenant_id', tenantB.id).in('status', ['pending', 'overdue'])
      ];

      await Promise.all(promises);

      setData(prev => {
        const nextTenants = prev.tenants.map(t => {
          if (t.id === tenantA.id) return { ...t, ...aUpdates };
          if (t.id === tenantB.id) return { ...t, ...bUpdates };
          return t;
        });

        const nextPayments = prev.payments.map(p => {
          if (p.status !== 'paid') {
            if (p.tenantId === tenantA.id) return { ...p, roomNumber: aUpdates.roomNumber, amount: aUpdates.rentAmount };
            if (p.tenantId === tenantB.id) return { ...p, roomNumber: bUpdates.roomNumber, amount: bUpdates.rentAmount };
          }
          return p;
        });

        return { ...prev, tenants: nextTenants, payments: nextPayments };
      });
      toast.success('Rooms swapped successfully!');
    } catch (err) {
      toast.error('Failed to swap rooms');
      console.error(err);
    }
  }, [data.tenants]);

  const checkoutTenant = useCallback(async (tenantId) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const tenantUpdates = { isActive: false, checkOutDate: new Date().toISOString().split('T')[0] };
    const room = currentRooms.find(r => r.id === tenant.roomId);

    let roomUpdates = null;
    if (room) {
      const newOccupants = Math.max(0, (room.currentOccupants || 0) - 1);
      roomUpdates = { 
        currentOccupants: newOccupants, 
        status: calculateRoomStatus(newOccupants, room.capacity, room.status === 'maintenance') 
      };
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
    const updates = { status: 'paid', paidDate: new Date().toISOString().split('T')[0] };
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

  const revertPayment = useCallback(async (paymentId) => {
    const updates = { status: 'pending', paidDate: null };
    try {
      const { error } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p)
      }));
      toast.success('Payment reverted to pending');
    } catch (err) {
      toast.error('Failed to revert payment');
      console.error(err);
    }
  }, []);

  const deletePayment = useCallback(async (paymentId) => {
    try {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.id !== paymentId)
      }));
      toast.success('Payment record deleted permanently');
    } catch (err) {
      toast.error('Failed to delete payment');
      console.error(err);
    }
  }, []);

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

  const addStaff = useCallback(async (staffMember) => {
    const newStaff = { ...staffMember, balance: 0, id: `staff-${Date.now()}`, hostelId: activeHostelId };
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

  const addStaffSalary = useCallback(async (staffId, amount) => {
    const staffMember = data.staff.find(s => s.id === staffId);
    if (!staffMember) return;
    const newBalance = (Number(staffMember.balance) || 0) + Number(amount);
    try {
      const { error } = await supabase.from('staff').update({ balance: newBalance }).eq('id', staffId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        staff: prev.staff.map(s => s.id === staffId ? { ...s, balance: newBalance } : s)
      }));
      toast.success('Salary added to balance');
    } catch (err) {
      toast.error('Failed to add salary');
      console.error(err);
    }
  }, [data.staff]);

  const payStaffCash = useCallback(async (staffId, amount) => {
    const staffMember = data.staff.find(s => s.id === staffId);
    if (!staffMember) return;
    const newBalance = (Number(staffMember.balance) || 0) - Number(amount);
    try {
      const { error } = await supabase.from('staff').update({ balance: newBalance }).eq('id', staffId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        staff: prev.staff.map(s => s.id === staffId ? { ...s, balance: newBalance } : s)
      }));
      toast.success('Cash payment recorded');
    } catch (err) {
      toast.error('Failed to record payment');
      console.error(err);
    }
  }, [data.staff]);

  const generateMonthlyBills = useCallback(async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // 1. Find all active tenants (checkout guard is built into currentTenants filtering)
    const activeTenants = currentTenants;
    
    // 2. Duplication guard: filter out tenants who already have a bill for the current month
    const tenantsToBill = activeTenants.filter(t => {
      const hasBill = currentPayments.some(p => p.tenantId === t.id && p.month === currentMonth);
      return !hasBill;
    });

    if (tenantsToBill.length === 0) {
      toast.info('All active tenants already have bills for this month.');
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(5); // 5th of the month due date
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const newBills = tenantsToBill.map(t => ({
      id: `p-${Date.now()}-${t.id}`,
      hostelId: activeHostelId,
      tenantId: t.id,
      tenantName: t.name,
      roomId: t.roomId,
      roomNumber: t.roomNumber,
      amount: t.rentAmount,
      month: currentMonth,
      dueDate: dueDateStr,
      status: 'pending'
    }));

    try {
      const { error } = await supabase.from('payments').insert(newBills.map(toSnakeCase));
      if (error) throw error;
      setData(prev => ({ ...prev, payments: [...prev.payments, ...newBills] }));
      toast.success(`Generated ${newBills.length} bills for ${currentMonth}`);
    } catch (err) {
      toast.error('Failed to generate bills');
      console.error(err);
    }
  }, [currentTenants, currentPayments, activeHostelId]);

  const getStats = useCallback(() => {
    const occupied = currentRooms.filter(r => r.status === 'occupied').length;
    const available = currentRooms.filter(r => r.status === 'available').length;
    const maintenance = currentRooms.filter(r => r.status === 'maintenance').length;
    const total = currentRooms.length;
    
    const totalBeds = currentRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const occupancyRate = totalBeds > 0 ? Math.round((currentTenants.length / totalBeds) * 100) : 0;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthPayments = currentPayments.filter(p => p.month === currentMonth);
    
    // Collected: Paid this month
    const collected = monthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    
    // Pending: Pending this month only (overdue is handled in Total Outstanding)
    const pending = monthPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    
    // Total Outstanding: Pending/Overdue ALL time (ignores written_off)
    const totalOutstanding = currentPayments
      .filter(p => p.status === 'pending' || p.status === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0);

    const overdue = currentPayments.filter(p => p.status === 'overdue').length;

    return { total, occupied, available, maintenance, occupancyRate, collected, pending, totalOutstanding, overdue, totalTenants: currentTenants.length };
  }, [currentRooms, currentPayments, currentTenants]);

  const value = {
    data, loading, currentHostel, currentRooms, currentTenants, currentPayments, currentStaff,
    addRoom, updateRoom, deleteRoom,
    addTenant, updateTenant, checkoutTenant, swapTenants,
    addPayment, updatePayment, recordPayment, revertPayment, deletePayment,
    updateHostel, getStats, generateMonthlyBills, hostels: data.hostels,
    isOwnerLoggedIn, ownerHostelId, ownerLogin, ownerLogout,
    addStaff, updateStaff, deleteStaff, addStaffSalary, payStaffCash,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
