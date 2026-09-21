# Hostello

Hostello is a Supabase-backed hostel operations app for room inventory, tenant
management, monthly rent billing, and an immutable owner audit timeline.

Before changing anything, read `CLAUDE.md` and `docs/CHANGE_PROCESS.md`.

## Local Setup

1. Copy `.env.example` to `.env.local` and add the public Supabase URL and anon key.
2. Run `npm install`.
3. Run the SQL migrations in `supabase/migrations` in filename order.
4. Create an owner in Supabase Auth and map it in `public.owner_profiles`.
5. Run `npm run dev`.

For local admin scripts, copy `.admin.env.example` to `.admin.env` and add a
service-role key. Never expose that key with a `VITE_` prefix or commit it.

## Verification

```bash
npm run lint
npm run build
npm audit
```

The payment cron is installed by the final migration and runs daily at midnight
Asia/Kolkata time. Operational owner actions are protected by RLS and recorded
by database triggers in `activity_logs`.
