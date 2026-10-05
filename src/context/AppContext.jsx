import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getCurrentMonth, getDueDateForMonth, toLocalDateString } from '../lib/date';
import { AppContext } from './app-context';

const ACTIVITY_PAGE_SIZE = 100;
// A phone that switches between wifi and mobile data, or locks its screen mid
// request, can lose the reply to a request the server already answered. Without
// a time limit the app waits for it for ever and stays on the loading screen.
const LOAD_TIMEOUT_MS = 15000;

const withTimeout = (promise, ms = LOAD_TIMEOUT_MS) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Request timed out. Please check your internet connection.')),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};
// Supabase returns at most 1,000 rows per request.  Tables that grow over
// time (tenants, payments) will silently lose older records without this.
const fetchAllRows = async (buildQuery) => {
  const PAGE = 1000;
  let all = [];
  for (let i = 0; i < 50; i++) {                     // safety cap: 50 000 rows
    const from = i * PAGE;
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;                    // last page
  }
  return all;
};

const PUBLIC_ROOM_COLUMNS = 'id,hostel_id,number,floor,type,price,status,capacity,current_occupants,amenities,has_attached_bath,has_ac,is_archived';

const emptyData = {
  hostels: [],
  rooms: [],
  tenants: [],
  payments: [],
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

const calculateRoomStatus = (occupants, capacity, isMaintenance) => {
  if (isMaintenance) return 'maintenance';
  if (occupants >= capacity) return 'occupied';
  return 'available';
};

const createId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

const sortActivityLogs = (logs) => [...logs].sort((a, b) => {
  const timeDifference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return timeDifference || String(b.id).localeCompare(String(a.id));
});

export function AppProvider({ children }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const ownerProfileRef = useRef(null);
  const [session, setSession] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [hasMoreActivityLogs, setHasMoreActivityLogs] = useState(false);
  const [loadingMoreActivityLogs, setLoadingMoreActivityLogs] = useState(false);

  const fetchPublicData = useCallback(async () => {
    const [{ data: hostelsData, error: hostelsError }, { data: roomsData, error: roomsError }] = await Promise.all([
      supabase.from('hostels').select('id,name,type,address,phone,whatsapp,email,description,nearby_landmarks,rating,total_rooms,amenities,rules,pricing,established,created_at'),
      supabase.from('rooms').select(PUBLIC_ROOM_COLUMNS).eq('is_archived', false)
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
    ownerProfileRef.current = null;
    setHasMoreActivityLogs(false);
    setData(prev => ({
      ...prev,
      tenants: [],
      payments: [],
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
      tenantsData,
      paymentsData,
      { data: activityLogsData, error: activityLogsError }
    ] = await Promise.all([
      supabase.from('hostels').select('*').eq('id', hostelId).single(),
      supabase.from('rooms').select('*').eq('hostel_id', hostelId),
      fetchAllRows(() => supabase.from('tenants').select('*').eq('hostel_id', hostelId)),
      fetchAllRows(() => supabase.from('payments').select('*').eq('hostel_id', hostelId)),
      supabase.from('activity_logs')
        .select('*')
        .eq('hostel_id', hostelId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(ACTIVITY_PAGE_SIZE)
    ]);

    const firstError = hostelError || roomsError || activityLogsError;
    if (firstError) throw firstError;

    const mappedHostel = mapKeys([hostelData])[0];
    setOwnerProfile({ userId, hostelId });
    ownerProfileRef.current = { userId, hostelId };
    setHasMoreActivityLogs((activityLogsData || []).length === ACTIVITY_PAGE_SIZE);
    
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
      activityLogs: mapKeys(activityLogsData || [])
    }));
  }, []);

  // Persistent database triggers and Realtime own the activity feed.
  const logActivity = useCallback(() => {}, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialData = async () => {
      try {
        const [{ data: authData }] = await withTimeout(Promise.all([
          supabase.auth.getSession(),
          fetchPublicData()
        ]));

        if (!isActive) return;

        const initialSession = authData.session;
        setSession(initialSession);

        if (initialSession) {
          await withTimeout(fetchOwnerData(initialSession.user.id));
        } else {
          clearOwnerData();
        }
      } catch (error) {
        console.error('Error loading Hostello data:', error);
        if (error?.code === 'PGRST116') {
          toast.error('This account is not linked to a hostel yet. Please contact support.');
        } else {
          toast.error('Could not load your data. Check your internet and press Retry.');
        }
        if (isActive) setLoadError(true);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadInitialData();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === 'SIGNED_OUT' || !nextSession) {
        clearOwnerData();
        return;
      }

      // The login quietly renews itself about once an hour (TOKEN_REFRESHED) and
      // fires again when the app regains focus. Re-downloading everything then is
      // pointless, and a failed download used to log the owner out.
      // INITIAL_SESSION is handled too, but only when the startup load did not
      // get the hostel (for example because it timed out). Without this the
      // owner would be left tapping Retry.
      const sessionArrivedLate = event === 'INITIAL_SESSION' && !ownerProfileRef.current;
      if (event !== 'SIGNED_IN' && !sessionArrivedLate) return;

      const loadOwner = async () => {
        try {
          await withTimeout(fetchOwnerData(nextSession.user.id));
        } catch (error) {
          console.error('Error loading owner data:', error);
          if (error?.code === 'PGRST116') {
            // No owner_profiles row: this account really is not linked to a hostel.
            toast.error('This account is not linked to a hostel yet. Please contact support.');
          } else {
            toast.error('Could not load your data. Check your internet and press Retry.');
          }
          setLoadError(true);
        }
      };

      loadOwner();
    });

    return () => {
      isActive = false;
      listener.subscription.unsubscribe();
    };
  }, [clearOwnerData, fetchOwnerData, fetchPublicData]);

  // Searching looks at the hostel's whole history in the database, not only the
  // lines already downloaded. Security rules still apply inside the function.
  const searchActivityLogs = useCallback(async ({ search, warningsOnly, before } = {}) => {
    const { data: rows, error } = await supabase.rpc('search_activity_logs', {
      p_search: search?.trim() || null,
      p_warnings_only: !!warningsOnly,
      p_before_created_at: before?.createdAt || null,
      p_before_id: before?.id || null,
      p_limit: ACTIVITY_PAGE_SIZE
    });
    if (error) throw error;
    return mapKeys(rows || []);
  }, []);

  const retryLoad = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      await withTimeout(fetchPublicData());
      const { data: authData } = await withTimeout(supabase.auth.getSession());
      if (authData.session) {
        await withTimeout(fetchOwnerData(authData.session.user.id));
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setLoadError(true);
      toast.error('Still could not load your data. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [fetchOwnerData, fetchPublicData]);

  const isOwnerLoggedIn = !!session && !!ownerProfile;
  const ownerHostelId = ownerProfile?.hostelId || null;

  useEffect(() => {
    if (!ownerHostelId) return undefined;

    const channel = supabase
      .channel(`activity-logs-${ownerHostelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `hostel_id=eq.${ownerHostelId}`
        },
        (payload) => {
          const newLog = mapKeys([payload.new])[0];
          setData(prev => {
            if (prev.activityLogs.some(log => log.id === newLog.id)) return prev;
            return {
              ...prev,
              activityLogs: sortActivityLogs([newLog, ...prev.activityLogs])
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerHostelId]);

  const loadMoreActivityLogs = useCallback(async () => {
    if (!ownerHostelId || loadingMoreActivityLogs || !hasMoreActivityLogs) return;

    const oldestLog = data.activityLogs[data.activityLogs.length - 1];
    if (!oldestLog) return;

    setLoadingMoreActivityLogs(true);
    try {
      const { data: olderLogs, error } = await supabase.rpc('get_activity_logs_page', {
        p_before_created_at: oldestLog.createdAt,
        p_before_id: oldestLog.id,
        p_limit: ACTIVITY_PAGE_SIZE
      });
      if (error) throw error;

      const mappedLogs = mapKeys(olderLogs || []);
      setHasMoreActivityLogs(mappedLogs.length === ACTIVITY_PAGE_SIZE);
      setData(prev => {
        const knownIds = new Set(prev.activityLogs.map(log => log.id));
        return {
          ...prev,
          activityLogs: sortActivityLogs([
            ...prev.activityLogs,
            ...mappedLogs.filter(log => !knownIds.has(log.id))
          ])
        };
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to load older activity');
    } finally {
      setLoadingMoreActivityLogs(false);
    }
  }, [data.activityLogs, hasMoreActivityLogs, loadingMoreActivityLogs, ownerHostelId]);

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

  const activeHostelId = useMemo(() => ownerHostelId || data.hostels[0]?.id, [ownerHostelId, data.hostels]);
  const currentHostel = useMemo(() => data.hostels.find(h => h.id === activeHostelId) || data.hostels[0], [data.hostels, activeHostelId]);
  const currentRooms = useMemo(() => data.rooms.filter(r => r.hostelId === activeHostelId && !r.isArchived), [data.rooms, activeHostelId]);
  const currentTenants = useMemo(() => data.tenants.filter(t => t.hostelId === activeHostelId && t.isActive), [data.tenants, activeHostelId]);
  const currentPayments = useMemo(() => data.payments.filter(p => p.hostelId === activeHostelId), [data.payments, activeHostelId]);

  const addRoom = useCallback(async (room) => {
    const newRoom = { ...room, id: createId('room'), hostelId: activeHostelId, isArchived: false };
    try {
      const { error } = await supabase.from('rooms').insert([toSnakeCase(newRoom)]);
      if (error) throw error;
      setData(prev => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
      logActivity('system', `System: Room ${newRoom.number} was added to the hostel.`);
      toast.success('Room added');
      return true;
    } catch (err) {
      toast.error('Failed to add room');
      console.error(err);
      return false;
    }
  }, [activeHostelId, logActivity]);

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
          // Match what the database does: only tenants living here now, and only
          // this month's unpaid bills. Older and paid bills keep their history.
          const currentMonth = getCurrentMonth();
          const tenantsInRoom = new Set(
            prev.tenants.filter(t => t.roomId === roomId && t.isActive).map(t => t.id)
          );
          nextTenants = prev.tenants.map(t =>
            t.roomId === roomId && t.isActive ? { ...t, roomNumber: updates.number } : t
          );
          nextPayments = prev.payments.map(p =>
            tenantsInRoom.has(p.tenantId)
              && p.month === currentMonth
              && (p.status === 'pending' || p.status === 'overdue')
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
      return true;
    } catch (err) {
      toast.error('Failed to update room');
      console.error(err);
      return false;
    }
  }, [currentRooms, logActivity]);

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
      return true;
    } catch (err) {
      if (err?.code === '23503') {
        toast.error('Cannot delete: This room has past tenants linked to it. Please rename it or mark it as maintenance instead.');
      } else {
        toast.error('Failed to delete room');
        console.error(err);
      }
      return false;
    }
  }, [currentRooms, logActivity]);

  const addTenant = useCallback(async (tenant) => {
    const newTenant = { ...tenant, id: createId('tenant'), hostelId: activeHostelId, isActive: true };
    const room = currentRooms.find(r => r.id === tenant.roomId);

    if (!room || room.isArchived || room.currentOccupants >= room.capacity) {
      toast.error('Selected room is no longer available');
      return false;
    }

    const newOccupants = (room.currentOccupants || 0) + 1;
    const roomUpdates = { 
      currentOccupants: newOccupants, 
      status: calculateRoomStatus(newOccupants, room.capacity, room.status === 'maintenance') 
    };

    const currentMonthStr = getCurrentMonth();
    const dueDateStr = getDueDateForMonth(currentMonthStr);

    const newPayment = {
      id: createId('payment'),
      hostelId: activeHostelId,
      tenantId: newTenant.id,
      tenantName: newTenant.name,
      roomNumber: newTenant.roomNumber,
      amount: newTenant.rentAmount,
      month: currentMonthStr,
      dueDate: dueDateStr,
      status: 'pending',
      source: 'check_in',
      isRemainder: false
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
      return true;
    } catch (err) {
      toast.error('Failed to add tenant');
      console.error(err);
      return false;
    }
  }, [activeHostelId, currentRooms, logActivity]);

  const updateTenant = useCallback(async (tenantId, updates) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return false;

    let stateUpdates = { rooms: null, paymentUpdates: null, rentUpdates: null };

    const isRoomChanging = !!(updates.roomId && updates.roomId !== tenant.roomId);
    if (isRoomChanging) {
      const oldRoom = currentRooms.find(r => r.id === tenant.roomId);
      const newRoom = currentRooms.find(r => r.id === updates.roomId);

      if (oldRoom && newRoom) {
        if (newRoom.isArchived || newRoom.currentOccupants >= newRoom.capacity) {
          toast.error('Destination room is no longer available');
          return false;
        }
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

        const currentMonthStr = getCurrentMonth();
        const newRoomNumber = updates.roomNumber || newRoom.number;
        stateUpdates.paymentUpdates = { tenantId, roomNumber: newRoomNumber, month: currentMonthStr };
      } else {
        toast.error('Unable to find the selected room');
        return false;
      }
    }

    const isRentChanging = updates.rentAmount !== undefined && Number(updates.rentAmount) !== Number(tenant.rentAmount);
    if (isRentChanging) {
      const currentMonthStr = getCurrentMonth();
      
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
        p_rent_changed: Boolean(stateUpdates.rentUpdates),
        p_new_rent_amount: stateUpdates.rentUpdates?.amount ?? null,
        p_current_month: isRoomChanging || isRentChanging ? getCurrentMonth() : null
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
      return true;
    } catch (err) {
      toast.error('Failed to update tenant');
      console.error(err);
      return false;
    }
  }, [data.tenants, currentRooms, data.payments, logActivity]);

  const swapTenants = useCallback(async (tenantAId, tenantBId) => {
    const tenantA = data.tenants.find(t => t.id === tenantAId);
    const tenantB = data.tenants.find(t => t.id === tenantBId);
    
    if (!tenantA || !tenantB) return false;

    // The logic: Tenant A gets B's room and rent. Tenant B gets A's room and rent.
    const aUpdates = { roomId: tenantB.roomId, roomNumber: tenantB.roomNumber, rentAmount: tenantB.rentAmount };
    const bUpdates = { roomId: tenantA.roomId, roomNumber: tenantA.roomNumber, rentAmount: tenantA.rentAmount };
    
    // Sync payment updates (Pending/Overdue only, for current month only)
    const currentMonthStr = getCurrentMonth();
    
    const aBills = data.payments.filter(p => p.tenantId === tenantA.id && p.month === currentMonthStr);
    const bBills = data.payments.filter(p => p.tenantId === tenantB.id && p.month === currentMonthStr);

    if (aBills.length > 1 || bBills.length > 1) {
      toast.error('Cannot swap tenants with partial payments. Settle bills first.');
      return false;
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
      return true;
    } catch (err) {
      toast.error('Failed to swap rooms');
      console.error(err);
      return false;
    }
  }, [data.tenants, data.payments, logActivity]);

  const checkoutTenant = useCallback(async (tenantId) => {
    const tenant = data.tenants.find(t => t.id === tenantId);
    if (!tenant) return false;

    // Strict Blocker: Prevent checkout if tenant has unpaid bills
    const unpaidBills = data.payments.filter(p => p.tenantId === tenantId && ['pending', 'overdue'].includes(p.status));
    if (unpaidBills.length > 0) {
      toast.error(`Cannot check out tenant. ${tenant.name} still has unpaid bills. Please collect the pending rent or manually mark the bills as written-off before checking them out.`, { duration: 6000 });
      return false;
    }

    const checkoutDate = toLocalDateString();
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
      return true;
    } catch (err) {
      toast.error('Failed to checkout tenant');
      console.error(err);
      return false;
    }
  }, [data.tenants, currentRooms, data.payments, logActivity]);

  const addPayment = useCallback(async (payment) => {
    const newPayment = {
      ...payment,
      id: createId('payment'),
      hostelId: activeHostelId,
      source: 'manual',
      isRemainder: false
    };
    try {
      const { error } = await supabase.from('payments').insert([toSnakeCase(newPayment)]);
      if (error) throw error;
      setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
      logActivity('payment', `WARNING: A manual payment record of ₹${Number(newPayment.amount).toLocaleString()} was created for ${newPayment.tenantName}.`);
      toast.success('Payment added');
      return true;
    } catch (err) {
      toast.error('Failed to add payment');
      console.error(err);
      return false;
    }
  }, [activeHostelId, logActivity]);

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
      return true;
    } catch (err) {
      toast.error('Failed to update payment');
      console.error(err);
      return false;
    }
  }, [data.payments, logActivity]);

  const recordPayment = useCallback(async (paymentId, amountReceived) => {
    const payment = data.payments.find(p => p.id === paymentId);
    if (!payment) return false;

    const actualAmount = amountReceived !== undefined ? Number(amountReceived) : payment.amount;
    if (!Number.isFinite(actualAmount) || actualAmount <= 0 || actualAmount > payment.amount) {
      toast.error('Enter a valid amount up to the bill total');
      return false;
    }
    const isPartial = actualAmount < payment.amount;
    const remainingAmount = payment.amount - actualAmount;

    try {
      const today = toLocalDateString();
      const updates = { status: 'paid', paidDate: today, amount: actualAmount };
      
      let newPayment = null;
      if (isPartial) {
        newPayment = {
          id: createId('payment'),
          hostelId: payment.hostelId,
          tenantId: payment.tenantId,
          tenantName: payment.tenantName,
          roomNumber: payment.roomNumber,
          amount: remainingAmount,
          month: payment.month,
          dueDate: payment.dueDate,
          status: payment.status === 'overdue' ? 'overdue' : 'pending',
          source: 'split',
          isRemainder: true
        };
      }

      // Atomic Transaction to prevent data drift on partial payments
      const { error: rpcError } = await supabase.rpc('record_payment_transaction', {
        p_payment_id: paymentId,
        p_actual_amount: actualAmount,
        p_paid_date: today,
        p_new_payment: newPayment ? toSnakeCase(newPayment) : null
      });
      if (rpcError) throw rpcError;

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
      return true;
    } catch (err) {
      toast.error('Failed to record payment');
      console.error(err);
      return false;
    }
  }, [data.payments, logActivity]);

  const revertPayment = useCallback(async (paymentId) => {
    const payment = data.payments.find(p => p.id === paymentId);

    if (payment) {
      const tenant = data.tenants.find(t => t.id === payment.tenantId);
      if (tenant && !tenant.isActive) {
        toast.error(`Cannot undo: ${payment.tenantName} has already checked out`);
        return false;
      }
    }

    let correctStatus = 'pending';
    if (payment) {
      const localToday = toLocalDateString();
      
      if (payment.dueDate && localToday > payment.dueDate) {
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
      return true;
    } catch (err) {
      toast.error(err?.message || 'Failed to revert payment');
      console.error(err);
      return false;
    }
  }, [data.payments, data.tenants, logActivity]);

  const cancelPayment = useCallback(async (paymentId) => {
    const payment = data.payments.find(p => p.id === paymentId);
    if (payment && payment.status === 'paid') {
      toast.error('Undo the payment before cancelling this bill');
      return false;
    }
    try {
      const { error } = await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.id === paymentId ? { ...p, status: 'cancelled' } : p)
      }));
      toast.success('Bill cancelled. It stays in the list and no longer counts in your totals.');
      return true;
    } catch (err) {
      toast.error(err?.message || 'Failed to cancel bill');
      console.error(err);
      return false;
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
      return true;
    } catch (err) {
      toast.error('Failed to update hostel profile');
      console.error(err);
      return false;
    }
  }, []);


  const getStats = useCallback(() => {
    const occupied = currentRooms.filter(r => r.status === 'occupied').length;
    const available = currentRooms.filter(r => r.status === 'available').length;
    const maintenance = currentRooms.filter(r => r.status === 'maintenance').length;
    const total = currentRooms.length;
    
    const totalBeds = currentRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const occupancyRate = totalBeds > 0 ? Math.round((currentTenants.length / totalBeds) * 100) : 0;

    const currentMonth = getCurrentMonth();
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
    data, loading, currentHostel, currentRooms, currentTenants, currentPayments,
    hasMoreActivityLogs, loadingMoreActivityLogs, loadMoreActivityLogs,
    addRoom, updateRoom, deleteRoom,
    addTenant, updateTenant, checkoutTenant, swapTenants,
    loadError, retryLoad, hasSession: !!session, searchActivityLogs,
    addPayment, updatePayment, recordPayment, revertPayment, cancelPayment,
    updateHostel, getStats, hostels: data.hostels,
    isOwnerLoggedIn, ownerHostelId, ownerLogin, ownerLogout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
