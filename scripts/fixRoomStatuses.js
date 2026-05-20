import { createSupabaseAdminClient } from './supabaseAdmin.js';

async function main() {
  const supabase = createSupabaseAdminClient();
  console.log('Fetching all rooms...');
  
  const { data: rooms, error } = await supabase.from('rooms').select('*');
  if (error) {
    console.error('Error fetching rooms:', error);
    process.exit(1);
  }
  
  let fixedCount = 0;
  
  for (const room of rooms) {
    const isMaintenance = room.status === 'maintenance';
    let correctStatus = 'available';
    if (isMaintenance) {
      correctStatus = 'maintenance';
    } else if (room.current_occupants >= room.capacity) {
      correctStatus = 'occupied';
    }
    
    if (room.status !== correctStatus) {
      console.log(`Fixing Room ${room.number}: ${room.status} -> ${correctStatus} (Occupants: ${room.current_occupants}/${room.capacity})`);
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: correctStatus })
        .eq('id', room.id);
        
      if (updateError) {
        console.error(`Failed to update room ${room.number}:`, updateError);
      } else {
        fixedCount++;
      }
    }
  }
  
  console.log(`Finished. Fixed ${fixedCount} rooms.`);
}

main();
