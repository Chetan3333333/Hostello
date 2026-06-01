import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { AppContext } from './app-context';

const emptyData = {
  hostels: [],
  rooms: [],
  tenants: [],
  payments: [],
  staff: [],
  activityLogs: []
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
      staff: [],
      activityLogs: []
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
      { data: staffData, error: staffError },
      { data: activityLogsData, error: activityLogsError }
    ] = await Promise.all([
      supabase.from('hostels').select('*').eq('id', hostelId).single(),
      supabase.from('rooms').select('*').eq('hostel_id', hostelId),
      supabase.from('tenants').select('*').eq('hostel_id', hostelId),
      supabase.from('payments').select('*').eq('hostel_id', hostelId),
      supabase.from('staff').select('*').eq('hostel_id', hostelId),
      supabase.from('activity_logs').select('*').eq('hostel_id', hostelId).order('created_at', { ascending: false }).limit(500)
    ]);

    const firstError = hostelError || roomsError || tenantsError || paymentsError || staffError || activityLogsError;
    if (firstError) throw firstError;

    const mappedHostel = mapKeys([hostelData])[0];
    setOwnerProfile({ userId, hostelId });
    
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
      payments: mapKeys(paymentsData),
      staff: mapKeys(staffData),
      activityLogs: mapKeys(activityLogsData || [])
    }));
  }, []);

  const logActivity = useCallback((type, message) => {
    // 🛡️ SECURITY UPDATE: The actual database logging is now handled by impenetrable Postgres Triggers.
    // This function now simply acts as an "Optimistic UI Update" to instantly show the log on the dashboard
    // without waiting for a network refresh or needing Supabase Realtime WebSockets.
    const activeHostelId = ownerProfile?.hostelId || data.hostels[0]?.id;
    if (!activeHostelId) return;
    
    const optimisticLog = {
      id: `temp-${Date.now()}-${Math.random()}`,
      hostelId: activeHostelId,
      type,
      message,
      createdAt: new Date().toISOString()
    };
    
    setData(prev => ({
      ...prev,
      activityLogs: [optimisticLog, ...prev.activityLogs]
    }));
  }, [ownerProfile, data.hostels]);

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
      logActivity('system', `System: Room ${newRoom.number} was added to the hostel.`);
      toast.success('Room added');
    } catch (err) {
      toast.error('Failed to add room');
      console.error(err);
    }
  }, [activeHostelId]);

  const updateRoom = useCallback(async (roomId, updates) => {
    const room = currentRooms.find(r => r.id === roomId);
    try {
      const isRenaming = !!(updates.number && room && updates.number !== room.number);
      
      const { error } = await supabase.rpc('update_room_transaction', {
        p_room_id: roomId,
        p_updates: toSnakeCase(updates),
        p_rename: isRenaming
      });
      if (error) throw error;

      setData(prev => {
        let nextTenants = prev.tenants;
        let nextPayments = prev.payments;

        if (isRenaming) {
          nextTenants = prev.tenants.map(t => t.roomId === roomId ? { ...t, roomNumber: updates.number } : t);
          nextPayments = prev.payments.map(p => 
            p.roomNumber === room.number
              ? { ...p, roomNumber: updates.number }
              : p
          );
        }

        return {
          ...prev,
          rooms: prev.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r),
          tenants: nextTenants,
          payments: nextPayments
        };
      });
      if (room && updates.status) {
        if (updates.status === 'maintenance' && room.status !== 'maintenance') {
          logActivity('room', `Room ${room.number} marked under maintenance`);
        } else if (updates.status === 'available' && room.status === 'maintenance') {
          logActivity('room', `Room ${room.number} is now available`);
        }
      }
      toast.success('Room updated');
    } catch (err) {
      toast.error('Failed to update room');
      console.error(err);
    }
  }, [currentRooms]);

  const deleteRoom = useCallback(async (roomId) => {
    const room = currentRooms.find(r => r.id === roomId);
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      setData(prev => ({ ...prev, rooms: prev.rooms.filter(r => r.id !== roomId) }));
      if (room) {
        logActivity('system', `WARNING: Room ${room.number} was permanently DELETED.`);
      }
      toast.success('Room deleted');
    } catch (err) {
      if (err?.code === '23503') {
        toast.error('Cannot delete: This room has past tenants linked to it. Please rename it or mark it as maintenance instead.');
      } else {
        toast.error('Failed to delete room');
        console.error(err);
      }
    }
  }, [currentRooms]);

  const addTenant = useCallback(async (tenant) => {
    const newTenant = { ...tenant, id: `t-${Date.now()}`, hostelId: activeHostelId, isActive: true };
    const room = currentRooms.find(r => r.id === tenant.roomId);

    if (!room) return;

    const newOccupants = (room.currentOccupants || 0) + 1;
    const roomUpdates = { 
      currentOccupants: newOccupants, 
      status: calculateRoomStatus(newOccupants, room.capacity, room.status === 'maintenance') 
    };

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = new Date();
    dueDate.setDate(10);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const newPayment = {
      id: `p-${Date.now()}-${newTenant.id}`,
      hostelId: activeHostelId,
      tenantId: newTenant.id,
      tenantName: newTenant.name,
      roomNumber: newTenant.roomNumber,
      amount: newTenant.rentAmount,
      month: currentMonthStr,
      dueDate: dueDateStr,
      status: 'pending'
    };

    try {
      const { error } = await supabase.rpc('add_tenant_transaction', {
        p_tenant: toSnakeCase(newTenant),
        p_payment: toSnakeCase(newPayment),
        p_room_updates: toSnakeCase(roomUpdates),
        p_room_id: room.id
      });
      if (error) throw error;

      setData(prev => ({
        ...prev,
        tenants: [...prev.tenants, newTenant],
        rooms: prev.rooms.map(r => r.id === room.id ? { ...r, ...roomUpdates } : r),
        payments: [newPayment, ...prev.payments]
      }));
      logActivity('tenant', `${newTenant.name} joined Room ${newTenant.roomNumber}`);
      toast.success('Tenant added successfully');
    } catch (err) {
      toast.error('Failed to add tenant');
      console.error(err);
    }
  }, [activeHostelId, currentRooms]);

  const updateTenant = useCallback(async (tenantId, updates) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    let stateUpdates = { rooms: null, paymentUpdates: null, rentUpdates: null };

    const isRoomChanging = !!(updates.roomId && updates.roomId !== tenant.roomId);
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

        stateUpdates.rooms = {
          old: { id: oldRoom.id, updates: oldRoomUpdates },
          new: { id: newRoom.id, updates: newRoomUpdates }
        };

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const newRoomNumber = updates.roomNumber || newRoom.number;
        stateUpdates.paymentUpdates = { tenantId, roomNumber: newRoomNumber, month: currentMonthStr };
      }
    }

    const isRentChanging = updates.rentAmount !== undefined && Number(updates.rentAmount) !== Number(tenant.rentAmount);
    if (isRentChanging) {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const tenantBillsThisMonth = data.payments.filter(p => p.tenantId === tenantId && p.month === currentMonthStr);
      if (tenantBillsThisMonth.length <= 1) {
        stateUpdates.rentUpdates = { tenantId, amount: updates.rentAmount, month: currentMonthStr };
      }
    }

    try {
      const rpcPayload = {
        p_tenant_id: tenantId,
        p_tenant_updates: toSnakeCase(updates),
        p_room_changed: isRoomChanging,
        p_old_room_id: isRoomChanging ? stateUpdates.rooms.old.id : null,
        p_new_room_id: isRoomChanging ? stateUpdates.rooms.new.id : null,
        p_old_room_occupants: isRoomChanging ? stateUpdates.rooms.old.updates.currentOccupants : null,
        p_new_room_occupants: isRoomChanging ? stateUpdates.rooms.new.updates.currentOccupants : null,
        p_old_room_status: isRoomChanging ? stateUpdates.rooms.old.updates.status : null,
        p_new_room_status: isRoomChanging ? stateUpdates.rooms.new.updates.status : null,
        p_new_room_number: isRoomChanging ? stateUpdates.paymentUpdates.roomNumber : null,
        p_rent_changed: isRentChanging,
        p_new_rent_amount: isRentChanging ? stateUpdates.rentUpdates?.amount || updates.rentAmount : null,
        p_current_month: isRoomChanging ? stateUpdates.paymentUpdates.month : (isRentChanging ? stateUpdates.rentUpdates?.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` : null)
      };

      const { error } = await supabase.rpc('update_tenant_transaction', rpcPayload);
      if (error) throw error;
      
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
        if (stateUpdates.paymentUpdates || stateUpdates.rentUpdates) {
          nextPayments = nextPayments.map(p => {
            if (p.tenantId === tenantId && ['pending', 'overdue'].includes(p.status)) {
              let updatedP = { ...p };
              if (stateUpdates.paymentUpdates && p.month === stateUpdates.paymentUpdates.month) {
                updatedP.roomNumber = stateUpdates.paymentUpdates.roomNumber;
              }
              if (stateUpdates.rentUpdates && p.month === stateUpdates.rentUpdates.month) {
                updatedP.amount = stateUpdates.rentUpdates.amount;
              }
              return updatedP;
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
      if (isRoomChanging) {
        logActivity('tenant', `${tenant.name} moved from Room ${tenant.roomNumber} to Room ${updates.roomNumber}`);
      }
      if (updates.rentAmount !== undefined && Number(updates.rentAmount) !== Number(tenant.rentAmount)) {
        logActivity('tenant', `WARNING: ${tenant.name}'s monthly rent was secretly changed from ₹${Number(tenant.rentAmount).toLocaleString()} to ₹${Number(updates.rentAmount).toLocaleString()}.`);
      }
      toast.success('Tenant updated');
    } catch (err) {
      toast.error('Failed to update tenant');
      console.error(err);
    }
  }, [data.tenants, currentRooms, data.payments]);

  const swapTenants = useCallback(async (tenantAId, tenantBId) => {
    const tenantA = data.tenants.find(t => t.id === tenantAId);
    const tenantB = data.tenants.find(t => t.id === tenantBId);
    
    if (!tenantA || !tenantB) return;

    // The logic: Tenant A gets B's room and rent. Tenant B gets A's room and rent.
    const aUpdates = { roomId: tenantB.roomId, roomNumber: tenantB.roomNumber, rentAmount: tenantB.rentAmount };
    const bUpdates = { roomId: tenantA.roomId, roomNumber: tenantA.roomNumber, rentAmount: tenantA.rentAmount };
    
    // Sync payment updates (Pending/Overdue only, for current month only)
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const aBills = data.payments.filter(p => p.tenantId === tenantA.id && p.month === currentMonthStr);
    const bBills = data.payments.filter(p => p.tenantId === tenantB.id && p.month === currentMonthStr);

    if (aBills.length > 1 || bBills.length > 1) {
      toast.error('Cannot swap tenants with partial payments. Settle bills first.');
      return;
    }

    try {
      const { error } = await supabase.rpc('swap_tenants_transaction', {
        p_tenant_a_id: tenantA.id,
        p_tenant_b_id: tenantB.id,
        p_a_room_id: tenantB.roomId,
        p_a_room_number: tenantB.roomNumber,
        p_a_rent_amount: tenantB.rentAmount,
        p_b_room_id: tenantA.roomId,
        p_b_room_number: tenantA.roomNumber,
        p_b_rent_amount: tenantA.rentAmount,
        p_current_month: currentMonthStr
      });
      if (error) throw error;

      setData(prev => {
        const nextTenants = prev.tenants.map(t => {
          if (t.id === tenantA.id) return { ...t, ...aUpdates };
          if (t.id === tenantB.id) return { ...t, ...bUpdates };
          return t;
        });

        const nextPayments = prev.payments.map(p => {
          if (['pending', 'overdue'].includes(p.status) && p.month === currentMonthStr) {
            if (p.tenantId === tenantA.id) return { ...p, roomNumber: aUpdates.roomNumber, amount: aUpdates.rentAmount };
            if (p.tenantId === tenantB.id) return { ...p, roomNumber: bUpdates.roomNumber, amount: bUpdates.rentAmount };
          }
          return p;
        });

        return { ...prev, tenants: nextTenants, payments: nextPayments };
      });
      logActivity('tenant', `${tenantA.name} and ${tenantB.name} swapped rooms`);
      toast.success('Rooms swapped successfully!');
    } catch (err) {
      toast.error('Failed to swap rooms');
      console.error(err);
    }
  }, [data.tenants, data.payments]);

  const checkoutTenant = useCallback(async (tenantId) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    // Strict Blocker: Prevent checkout if tenant has unpaid bills
    const unpaidBills = data.payments.filter(p => p.tenantId === tenantId && ['pending', 'overdue'].includes(p.status));
    if (unpaidBills.length > 0) {
      toast.error(`Cannot check out tenant. ${tenant.name} still has unpaid bills. Please collect the pending rent or manually mark the bills as written-off before checking them out.`, { duration: 6000 });
      return;
    }

    const checkoutDate = new Date().toISOString().split('T')[0];
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
      const { error } = await supabase.rpc('checkout_tenant_transaction', {
        p_tenant_id: tenantId,
        p_checkout_date: checkoutDate,
        p_room_id: room ? room.id : null,
        p_new_occupants: roomUpdates ? roomUpdates.currentOccupants : null,
        p_room_status: roomUpdates ? roomUpdates.status : null
      });
      if (error) throw error;

      setData(prev => ({
        ...prev,
        tenants: prev.tenants.map(t => t.id === tenantId ? { ...t, isActive: false, checkOutDate: checkoutDate } : t),
        rooms: roomUpdates ? prev.rooms.map(r => r.id === room.id ? { ...r, ...roomUpdates } : r) : prev.rooms
      }));
      logActivity('tenant', `${tenant.name} checked out from Room ${tenant.roomNumber}`);
      toast.success('Tenant checked out');
    } catch (err) {
      toast.error('Failed to checkout tenant');
      console.error(err);
    }
  }, [data.tenants, currentRooms, data.payments]);

  const addPayment = useCallback(async (payment) => {
    const newPayment = { ...payment, id: `pay-${Date.now()}`, hostelId: activeHostelId };
    try {
      const { error } = await supabase.from('payments').insert([toSnakeCase(newPayment)]);
      if (error) throw error;
      setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
      logActivity('payment', `WARNING: A manual payment record of ₹${Number(newPayment.amount).toLocaleString()} was created for ${newPayment.tenantName}.`);
      toast.success('Payment added');
    } catch (err) {
      toast.error('Failed to add payment');
      console.error(err);
    }
  }, [activeHostelId]);

  const updatePayment = useCallback(async (paymentId, updates) => {
    const payment = data.payments.find(p => p.id === paymentId);
    try {
      const { error } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p)
      }));
      if (updates.status === 'written_off' && payment) {
        logActivity('payment', `₹${payment.amount.toLocaleString()} written off for ${payment.tenantName}`);
      }
      if (updates.amount !== undefined && Number(updates.amount) !== Number(payment?.amount)) {
        logActivity('payment', `WARNING: Pending bill amount for ${payment?.tenantName} was altered from ₹${Number(payment?.amount).toLocaleString()} to ₹${Number(updates.amount).toLocaleString()}.`);
      }
      toast.success('Payment updated');
    } catch (err) {
      toast.error('Failed to update payment');
      console.error(err);
    }
  }, [data.payments]);

  const recordPayment = useCallback(async (paymentId, amountReceived) => {
    const payment = data.payments.find(p => p.id === paymentId);
    if (!payment) return;

    const actualAmount = amountReceived !== undefined ? Number(amountReceived) : payment.amount;
    const isPartial = actualAmount < payment.amount;
    const remainingAmount = payment.amount - actualAmount;

    try {
      const today = new Date().toISOString().split('T')[0];
      const updates = { status: 'paid', paidDate: today, amount: actualAmount };
      
      let newPayment = null;
      if (isPartial) {
        newPayment = {
          id: `pay-${Date.now()}`,
          hostelId: payment.hostelId,
          tenantId: payment.tenantId,
          tenantName: payment.tenantName,
          roomNumber: payment.roomNumber,
          amount: remainingAmount,
          month: payment.month,
          dueDate: payment.dueDate,
          status: payment.status === 'overdue' ? 'overdue' : 'pending',
          createdAt: today
        };
      }

      // Update original payment to paid
      const { error: updateError } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (updateError) throw updateError;

      // Insert remainder bill for split invoices
      if (newPayment) {
        const { error: insertError } = await supabase.from('payments').insert([toSnakeCase(newPayment)]);
        if (insertError) throw insertError;
      }

      setData(prev => {
        let nextPayments = prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p);
        if (newPayment) {
          nextPayments = [newPayment, ...nextPayments];
        }
        return { ...prev, payments: nextPayments };
      });

      logActivity('payment', `₹${actualAmount.toLocaleString()} received from ${payment.tenantName}`);
      if (isPartial) {
        logActivity('payment', `Invoice split: New pending bill of ₹${remainingAmount.toLocaleString()} created for ${payment.tenantName}`);
      }
      toast.success(isPartial ? 'Partial payment recorded & invoice split' : 'Payment recorded');
    } catch (err) {
      toast.error('Failed to record payment');
      console.error(err);
    }
  }, [data.payments, logActivity]);

  const revertPayment = useCallback(async (paymentId) => {
    const payment = data.payments.find(p => p.id === paymentId);
    
    let correctStatus = 'pending';
    if (payment) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentDate = now.getDate();
      
      const [paymentYearStr, paymentMonthStr] = payment.month.split('-');
      const paymentYear = parseInt(paymentYearStr, 10);
      const paymentMonth = parseInt(paymentMonthStr, 10);
      
      if (currentYear > paymentYear || (currentYear === paymentYear && currentMonth > paymentMonth)) {
        correctStatus = 'overdue';
      } else if (currentYear === paymentYear && currentMonth === paymentMonth && currentDate > 10) {
        correctStatus = 'overdue';
      }
    }

    const updates = { status: correctStatus, paidDate: null };
    try {
      const { error } = await supabase.from('payments').update(toSnakeCase(updates)).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, ...updates } : p)
      }));
      if (payment) {
        logActivity('payment', `Payment of ₹${payment.amount.toLocaleString()} undone for ${payment.tenantName}`);
      }
      toast.success(`Payment reverted to ${correctStatus}`);
    } catch (err) {
      toast.error('Failed to revert payment');
      console.error(err);
    }
  }, [data.payments]);

  const deletePayment = useCallback(async (paymentId) => {
    const payment = data.payments.find(p => p.id === paymentId);
    try {
      const { error } = await supabase.from('payments').delete().eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.id !== paymentId)
      }));
      if (payment) {
        logActivity('payment', `WARNING: Payment record of ₹${Number(payment.amount).toLocaleString()} for ${payment.tenantName} was permanently DELETED.`);
      }
      toast.success('Payment record deleted permanently');
    } catch (err) {
      toast.error('Failed to delete payment');
      console.error(err);
    }
  }, [data.payments]);

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
    updateHostel, getStats, hostels: data.hostels,
    isOwnerLoggedIn, ownerHostelId, ownerLogin, ownerLogout,
    addStaff, updateStaff, deleteStaff, addStaffSalary, payStaffCash,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
