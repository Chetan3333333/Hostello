import { createSupabaseAdminClient, requireWipeConfirmation } from './scripts/supabaseAdmin.js';

requireWipeConfirmation();

const supabase = createSupabaseAdminClient();

async function deleteTableData(table) {
  const { error } = await supabase.from(table).delete().neq('id', '__never__');
  if (error) throw new Error(`${table} wipe failed: ${error.message}`);
  console.log(`Deleted ${table}`);
}

async function wipeData() {
  console.log('Wiping Hostello operational data...');

  await deleteTableData('payments');
  await deleteTableData('tenants');
  await deleteTableData('rooms');
  await deleteTableData('staff');

  console.log('Data wiped successfully. Hostels and owner mappings were kept.');
}

wipeData().catch(error => {
  console.error(error.message);
  process.exit(1);
});
