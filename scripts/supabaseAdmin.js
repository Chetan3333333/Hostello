import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  const envPath = resolve('.env.local');
  if (!existsSync(envPath)) return;

  const envText = readFileSync(envPath, 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  }
}

function requireEnv(name, fallbackNames = []) {
  const candidates = [name, ...fallbackNames];
  for (const candidate of candidates) {
    if (process.env[candidate]) return process.env[candidate];
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

export function createSupabaseAdminClient() {
  loadLocalEnv();

  const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function requireWipeConfirmation() {
  loadLocalEnv();
  if (process.env.CONFIRM_WIPE !== 'YES_DELETE_HOSTELLO_DATA') {
    throw new Error('Refusing to wipe data. Set CONFIRM_WIPE=YES_DELETE_HOSTELLO_DATA to continue.');
  }
}
