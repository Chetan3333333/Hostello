/**
 * Hostello restore
 *
 *   node scripts/restore.js backups/<date>            (dry run: shows what it would do)
 *   node scripts/restore.js backups/<date> --confirm  (actually writes)
 *
 * Puts the rows from a backup folder back into the database. Existing rows with
 * the same id are overwritten; rows added since the backup are left alone, so
 * this never deletes anything by itself.
 *
 * Tables are written parents first, because a bill needs its tenant to exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin } from './supabaseAdmin.js';

const ORDER = ['hostels', 'owner_profiles', 'rooms', 'tenants', 'payments', 'activity_logs'];
const CHUNK = 500;

async function main() {
  const dir = process.argv[2];
  const confirmed = process.argv.includes('--confirm');
  if (!dir) {
    console.error('Usage: node scripts/restore.js backups/<date> [--confirm]');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`No such backup folder: ${dir}`);
    process.exit(1);
  }

  console.log(confirmed ? `Restoring from ${dir}` : `DRY RUN of ${dir} (add --confirm to write)`);

  for (const table of ORDER) {
    const file = path.join(dir, `${table}.json`);
    if (!fs.existsSync(file)) { console.log(`  ${table.padEnd(16)} not in this backup, skipped`); continue; }
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!confirmed) { console.log(`  ${table.padEnd(16)} would restore ${rows.length} rows`); continue; }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin.from(table).upsert(slice);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  ${table.padEnd(16)} restored ${rows.length} rows`);
  }

  console.log(confirmed ? '\nRestore finished. Open the app and check the numbers.' : '\nNothing was written.');
}

main().catch(err => { console.error('Restore FAILED:', err.message); process.exit(1); });
