global.localStorage = { getItem: () => null, setItem: () => {} };
import { createClient } from '@supabase/supabase-js';
import { getInitialData } from './src/data/mockData.js';

// Setup supabase manually using the env values so we can run this from node
const supabase = createClient(
  'https://sbcdpgmmsnbnyvtiveso.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiY2RwZ21tc25ibnl2dGl2ZXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjY2NzAsImV4cCI6MjA5NDI0MjY3MH0.Ex0py8hE894gjuQkh_RXjj__c_Mxe9X34Kjud6y3vvk'
);

const toSnakeCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    if (key === 'createdAt') continue;
    if (key === 'hasAC') {
      newObj['has_ac'] = obj[key];
      continue;
    }
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

async function seed() {
  console.log('Fetching mock data...');
  const data = getInitialData();
  
  // 1. We already have the hostel in DB from SQL. 
  
  // 2. Insert Rooms
  console.log(`Inserting ${data.rooms.length} rooms...`);
  const { error: roomsErr } = await supabase.from('rooms').insert(data.rooms.map(toSnakeCase));
  if (roomsErr) console.error('Rooms Error:', roomsErr);

  // 3. Insert Tenants
  console.log(`Inserting ${data.tenants.length} tenants...`);
  const { error: tenantsErr } = await supabase.from('tenants').insert(data.tenants.map(toSnakeCase));
  if (tenantsErr) console.error('Tenants Error:', tenantsErr);

  // 4. Insert Payments
  console.log(`Inserting ${data.payments.length} payments...`);
  const { error: paymentsErr } = await supabase.from('payments').insert(data.payments.map(toSnakeCase));
  if (paymentsErr) console.error('Payments Error:', paymentsErr);

  // 5. Insert Staff
  console.log(`Inserting ${data.staff.length} staff...`);
  const { error: staffErr } = await supabase.from('staff').insert(data.staff.map(toSnakeCase));
  if (staffErr) console.error('Staff Error:', staffErr);

  console.log('Seeding complete!');
}

seed();
