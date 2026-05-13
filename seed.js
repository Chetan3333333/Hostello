import { getInitialData, hostelsData } from './src/data/mockData.js';
import { createSupabaseAdminClient } from './scripts/supabaseAdmin.js';

const supabase = createSupabaseAdminClient();

const toSnakeCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    if (key === 'createdAt') continue;
    if (key === 'currentHostelId') continue;
    if (key === 'ownerAuth') continue;
    if (key === 'pin') continue;

    if (key === 'hasAC') {
      newObj.has_ac = obj[key];
      continue;
    }

    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

async function upsertTable(table, rows) {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from(table)
    .upsert(rows.map(toSnakeCase), { onConflict: 'id' });

  if (error) throw new Error(`${table} seed failed: ${error.message}`);
  console.log(`Seeded ${rows.length} ${table} rows`);
}

async function seed() {
  console.log('Seeding Hostello one-hostel dataset...');
  const data = getInitialData({ persist: false });

  await upsertTable('hostels', hostelsData);
  await upsertTable('rooms', data.rooms);
  await upsertTable('tenants', data.tenants);
  await upsertTable('payments', data.payments);
  await upsertTable('staff', data.staff);

  console.log('Seeding complete.');
}

seed().catch(error => {
  console.error(error.message);
  process.exit(1);
});
