/**
 * Hostello backup
 *
 *   node scripts/backup.js
 *
 * Saves every table to backups/<date>/ as JSON, plus a summary.
 * Needs .admin.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Keep the backups folder OUT of git (it holds tenants' personal details) and
 * copy it somewhere off this computer, for example Google Drive. A backup that
 * lives only on the laptop dies with the laptop.
 *
 * Restore with: node scripts/restore.js backups/<date>
 */
import fs from 'node:fs';
import path from 'node:path';
import { supabaseAdmin } from './supabaseAdmin.js';

const TABLES = ['hostels', 'owner_profiles', 'rooms', 'tenants', 'payments', 'activity_logs'];
const PAGE = 1000;

async function fetchAll(table) {
  let rows = [];
  for (let page = 0; page < 100; page += 1) {
    const from = page * PAGE;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows = rows.concat(data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const dir = path.join('backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  const summary = { takenAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    const rows = await fetchAll(table);
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    summary.tables[table] = rows.length;
    console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
  }

  fs.writeFileSync(path.join(dir, '_summary.json'), JSON.stringify(summary, null, 2));
  const total = Object.values(summary.tables).reduce((a, b) => a + b, 0);
  console.log(`\nBackup saved to ${dir} (${total} rows in total).`);
  if (summary.tables.payments === 0 && summary.tables.tenants === 0) {
    console.log('WARNING: the database looks empty. Check you are pointing at the right project.');
  }
  console.log('Now copy this folder somewhere off this computer.');
}

main().catch(err => { console.error('Backup FAILED:', err.message); process.exit(1); });
