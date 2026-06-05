import { toLocalDateString } from '../lib/date.js';

// Mock data for Hostello — Single hostel near Mallareddy Engineering College

export const hostelsData = [
  {
    id: 'h1',
    name: 'Sri Sai Boys Hostel',
    type: 'boys',
    address: 'Plot 45, Maisammaguda, Dhulapally, Secunderabad - 500100',
    phone: '9876543210',
    whatsapp: '9876543210',
    email: 'srisaihostel@gmail.com',
    description: 'A well-maintained boys hostel with spacious rooms, healthy food, and 24/7 security. Located just 2 minutes walk from Mallareddy Engineering College. We provide a home-like atmosphere for students.',
    nearbyLandmarks: [
      'Mallareddy Engineering College - 200m',
      'Mallareddy Institute of Technology - 600m',
      'Maisammaguda Bus Stop - 150m',
      'Dhulapally X Road - 400m',
      'Apollo Pharmacy - 100m',
    ],
    rating: 4.3,
    totalRooms: 20,
    amenities: ['wifi', 'food', 'ro_water', 'power_backup', 'parking', 'cctv', 'laundry', 'study_room', 'hot_water'],
    rules: '1. Gate closes at 10:00 PM\n2. No smoking or alcohol\n3. Visitors allowed only in common area\n4. Maintain cleanliness\n5. ID card mandatory',
    images: [],
    pricing: { '3_sharing': 4500, '4_sharing': 3800, '5_sharing': 3200, '6_sharing': 2800 },
    established: '2018',
  },
];

// Generate rooms for the hostel
function generateRooms(hostel) {
  const rooms = [];
  const types = Object.keys(hostel.pricing);
  const statuses = ['occupied', 'occupied', 'occupied', 'available', 'occupied', 'available', 'occupied', 'maintenance'];
  let roomNum = 101;
  
  for (let floor = 1; floor <= Math.ceil(hostel.totalRooms / 6); floor++) {
    for (let r = 0; r < Math.min(6, hostel.totalRooms - (floor - 1) * 6); r++) {
      const type = types[r % types.length];
      const status = statuses[(floor * 6 + r) % statuses.length];
      const capacity = parseInt(type.split('_')[0]);
      rooms.push({
        id: `${hostel.id}-r${roomNum}`,
        hostelId: hostel.id,
        number: `${roomNum}`,
        floor: floor,
        type: type,
        price: hostel.pricing[type],
        status: status,
        capacity: capacity,
        currentOccupants: status === 'occupied' ? ((floor + r) % capacity) + 1 : 0,
        amenities: ['beds', 'tables', 'chairs', 'fan', 'cupboard'],
        hasAttachedBath: false,
        hasAc: (floor + r) % 4 === 0,
      });
      roomNum++;
    }
  }
  return rooms;
}

const studentFirstNames = ['Rahul', 'Arun', 'Karthik', 'Ravi', 'Suresh', 'Vikram', 'Harish', 'Manoj', 'Deepak', 'Naveen', 'Prasad', 'Sai', 'Venkat', 'Rajesh', 'Ganesh'];
const studentLastNames = ['Reddy', 'Kumar', 'Sharma', 'Naidu', 'Rao', 'Singh', 'Patel', 'Goud', 'Chary', 'Varma', 'Prasad', 'Gupta', 'Yadav', 'Deshmukh', 'Kiran'];
const colleges = ['Mallareddy Engineering College', 'Mallareddy Institute of Technology', 'Mallareddy College of Engineering'];
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

function generateTenants(rooms, hostelId) {
  const tenants = [];
  let idx = 0;
  const hostelRooms = rooms.filter(r => r.hostelId === hostelId && r.status === 'occupied');
  
  hostelRooms.forEach(room => {
    for (let o = 0; o < room.currentOccupants; o++) {
      const fn = studentFirstNames[(idx * 3 + o) % studentFirstNames.length];
      const ln = studentLastNames[(idx * 2 + o) % studentLastNames.length];
      const checkInMonth = (idx + o) % 6;
      const checkIn = new Date(2025, 5 + checkInMonth, ((idx + o) % 28) + 1);
      tenants.push({
        id: `t-${hostelId}-${idx}-${o}`,
        hostelId: hostelId,
        roomId: room.id,
        roomNumber: room.number,
        name: `${fn} ${ln}`,
        phone: `9${String(100000000 + idx * 37 + o).padStart(9, '0')}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${String(idx + o).padStart(2, '0')}@gmail.com`,
        college: colleges[idx % colleges.length],
        year: years[o % years.length],
        parentName: `${studentFirstNames[(idx + 5) % studentFirstNames.length]} ${ln}`,
        parentPhone: `9${String(200000000 + idx * 41 + o).padStart(9, '0')}`,
        idProof: 'Aadhar Card',
        idNumber: `${1000 + idx} ${2000 + o} ${3000 + idx + o}`,
        rentAmount: room.price,
        securityDeposit: room.price,
        checkInDate: toLocalDateString(checkIn),
        checkOutDate: null,
        isActive: true,
      });
      idx++;
    }
  });
  return tenants;
}

function generatePayments(tenants, hostelId) {
  const payments = [];
  const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
  const methods = ['UPI', 'Cash', 'Bank Transfer', 'UPI', 'Cash', 'UPI'];
  const hostelTenants = tenants.filter(t => t.hostelId === hostelId && t.isActive);
  
  hostelTenants.forEach((tenant, tIdx) => {
    const startMonth = Math.max(0, months.findIndex(m => m >= tenant.checkInDate.substring(0, 7)));
    
    for (let m = startMonth; m < months.length; m++) {
      const isPaid = m < months.length - 1 ? (tIdx + m) % 7 !== 0 : tIdx % 3 !== 0;
      const isOverdue = !isPaid && m < months.length - 1;
      const paidDate = isPaid ? `${months[m]}-${String(((tIdx + m) % 5) + 1).padStart(2, '0')}` : null;
      
      payments.push({
        id: `pay-${hostelId}-${tIdx}-${m}`,
        hostelId: hostelId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        roomNumber: tenant.roomNumber,
        amount: tenant.rentAmount,
        month: months[m],
        dueDate: `${months[m]}-10`,
        paidDate: paidDate,
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        method: isPaid ? methods[(tIdx + m) % methods.length] : null,
        receiptNote: isPaid ? `Rent for ${months[m]}` : null,
      });
    }
  });
  return payments;
}

// Staff for the hostel
function generateStaff(hostelId) {
  const staffList = [
    { name: 'Ramesh Kumar', role: 'mess_cook', phone: '9876001001', salary: 15000, joinDate: '2022-06-15', status: 'present' },
    { name: 'Lakshmi Devi', role: 'helper', phone: '9876001002', salary: 8000, joinDate: '2023-01-10', status: 'present' },
    { name: 'Surender Singh', role: 'security', phone: '9876001003', salary: 12000, joinDate: '2021-08-01', status: 'present' },
    { name: 'Parveen Begum', role: 'cleaning', phone: '9876001004', salary: 9000, joinDate: '2023-03-20', status: 'leave' },
    { name: 'Raju Yadav', role: 'helper', phone: '9876001005', salary: 8000, joinDate: '2024-02-01', status: 'present' },
  ];
  
  return staffList.map((s, i) => ({
    ...s,
    id: `staff-${hostelId}-${i}`,
    hostelId,
  }));
}

// Build complete dataset
export function getInitialData({ persist = true } = {}) {
  const storage = typeof localStorage === 'undefined' ? null : localStorage;
  const existing = persist ? storage?.getItem('hostello_data') : null;
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      // Check if data has the current single-hostel structure
      if (parsed.staff && parsed.hostels?.length === 1 && !parsed.hostels[0]?.pin && !parsed.chats) {
        return parsed;
      }
      console.log('Regenerating data for single-hostel mode...');
    } catch {
      console.error('Failed to parse stored data, regenerating...');
    }
  }
  
  const hostel = hostelsData[0];
  const rooms = generateRooms(hostel);
  const tenants = generateTenants(rooms, hostel.id);
  const payments = generatePayments(tenants, hostel.id);
  const staff = generateStaff(hostel.id);
  
  const data = {
    hostels: hostelsData,
    rooms,
    tenants,
    payments,
    staff,
    currentHostelId: hostel.id,
    ownerAuth: null,
  };
  
  if (persist) {
    storage?.setItem('hostello_data', JSON.stringify(data));
  }
  return data;
}

export const amenityLabels = {
  wifi: { label: 'WiFi', icon: 'Wifi' },
  food: { label: 'Food/Mess', icon: 'UtensilsCrossed' },
  ro_water: { label: 'RO Water', icon: 'Droplets' },
  power_backup: { label: 'Power Backup', icon: 'Zap' },
  parking: { label: 'Parking', icon: 'Car' },
  cctv: { label: 'CCTV', icon: 'Camera' },
  laundry: { label: 'Laundry', icon: 'WashingMachine' },
  study_room: { label: 'Study Room', icon: 'BookOpen' },
  hot_water: { label: 'Hot Water', icon: 'Flame' },
  gym: { label: 'Gym', icon: 'Dumbbell' },
  warden: { label: '24/7 Warden', icon: 'Shield' },
  ac: { label: 'AC Rooms', icon: 'AirVent' },
  attached_bathroom: { label: 'Attached Bath', icon: 'Bath' },
  tv_room: { label: 'TV Room', icon: 'Tv' },
};

export const roomTypeLabels = {
  '1_sharing': '1 Sharing (Single)',
  '2_sharing': '2 Sharing',
  '3_sharing': '3 Sharing',
  '4_sharing': '4 Sharing',
  '5_sharing': '5 Sharing',
  '6_sharing': '6 Sharing',
  '7_sharing': '7 Sharing',
  '8_sharing': '8 Sharing',
  '9_sharing': '9 Sharing',
  '10_sharing': '10 Sharing',
  '11_sharing': '11 Sharing',
  '12_sharing': '12 Sharing',
  '13_sharing': '13 Sharing',
  '14_sharing': '14 Sharing',
  '15_sharing': '15 Sharing',
  '16_sharing': '16 Sharing',
  '17_sharing': '17 Sharing',
  '18_sharing': '18 Sharing',
  '19_sharing': '19 Sharing',
  '20_sharing': '20 Sharing',
};

export const staffRoleLabels = {
  mess_cook: 'Mess Cook',
  helper: 'Helper',
  cleaning: 'Cleaning Staff',
  security: 'Watchman / Security',
  warden: 'Warden',
};

export const staffStatusLabels = {
  present: { label: 'Present', color: 'success' },
  absent: { label: 'Absent', color: 'danger' },
  leave: { label: 'On Leave', color: 'warning' },
};
