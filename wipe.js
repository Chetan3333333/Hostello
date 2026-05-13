import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://sbcdpgmmsnbnyvtiveso.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiY2RwZ21tc25ibnl2dGl2ZXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjY2NzAsImV4cCI6MjA5NDI0MjY3MH0.Ex0py8hE894gjuQkh_RXjj__c_Mxe9X34Kjud6y3vvk'
);

async function wipeData() {
  console.log('Wiping all test data...');

  // Delete in order of dependencies to avoid foreign key constraints
  
  console.log('Deleting payments...');
  const { error: err1 } = await supabase.from('payments').delete().neq('id', '0');
  if (err1) console.error(err1);

  console.log('Deleting tenants...');
  const { error: err2 } = await supabase.from('tenants').delete().neq('id', '0');
  if (err2) console.error(err2);

  console.log('Deleting rooms...');
  const { error: err3 } = await supabase.from('rooms').delete().neq('id', '0');
  if (err3) console.error(err3);

  console.log('Deleting staff...');
  const { error: err4 } = await supabase.from('staff').delete().neq('id', '0');
  if (err4) console.error(err4);

  console.log('Data wiped successfully! (Hostel profile was kept so you can still log in)');
}

wipeData();
