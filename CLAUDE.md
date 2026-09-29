# CLAUDE.md — Hostello working rules and project map

Read this before changing anything. It applies to every AI agent (Claude,
Codex, Antigravity, …) and to every human working on this repository.

## 1. Non-negotiable rules

1. **Ask before every step.** Propose the change first: what, why, which files,
   database impact, risk and rollback. Wait for the owner's explicit approval
   before changing code, the database, settings or git history.
2. **Never commit or push to `main`.** `main` auto-deploys to the live website.
   Work on the `claude` branch. The owner opens the pull request into `main`
   and merges it with **"Create a merge commit"** (never "Squash").
3. **One logical change per commit.** Use the message format in
   `docs/CHANGE_PROCESS.md`, describe only what the diff actually does, and run
   `npm run lint` and `npm run build` before every commit.
4. **Database changes are new numbered migrations.** Add
   `supabase/migrations/NN_name.sql` together with
   `supabase/rollbacks/NN_name.down.sql`. Never edit a migration that has
   already been applied. Test on a non-production database first. Nothing runs
   on production without a fresh backup and the owner's approval.
5. **Deploy order matters.** A database change must keep working with the
   website that is currently deployed. If it cannot, the code change ships
   first and the database change follows later.
6. **Secrets stay out.** Never read, print, paste or commit `.env.local`,
   `.admin.env` or any secret / service-role key. Never run `seed.js`,
   `wipe.js` or `scripts/*` against production: they use the service-role key
   and bypass every security rule.
7. **One agent at a time** works on this repository.

## 2. What Hostello is

- React 19 + Vite single-page app. Backend: Supabase project
  `sbcdpgmmsnbnyvtiveso` (Postgres 17, Auth, Realtime, pg_cron; region
  ap-south-1, Mumbai).
- One owner account manages one hostel (`owner_profiles` maps an Auth user to a
  hostel).
- Public pages (no login): `/` landing, `/search`, `/hostel/:id`. They read the
  `hostels` table and a limited set of `rooms` columns.
- Owner app (`/owner/*`, login required): dashboard, rooms, tenants, payments
  and hostel profile. (The Staff section was removed on 2026-09-20; see
  section 3.)
- `src/context/AppContext.jsx` loads all of the owner's data at login and
  exposes every action the pages use.
- Changes that touch several tables go through database functions in
  `supabase/migrations/08_secure_transactions.sql`. They run with the caller's
  permissions, so row-level security still applies.
- Database triggers (migration 09) record changes to rooms, tenants and
  payments in `activity_logs`. The app can read the log but cannot edit or
  delete it.
- Billing: the pg_cron job `daily_payment_automation` runs
  `process_daily_payments()` every day at 00:00 IST. It marks unpaid bills past
  their due date as overdue and, on the 1st of the month only, creates that
  month's bill for every active tenant (due on the 10th).

## 3. Current state (updated 2026-09-22)

- **Not in real use yet.** As of 2026-09-19 the live database held the demo
  dataset (all seeded tenants unchanged, demo listing "Sri Sai Boys Hostel")
  plus a few entries added through the app (see "Test vs real database"
  below).
- **Staff section removed** (owner's decision, 2026-09-20).
  Phase 1 (2026-09-20): removed from the code. `/owner/staff` redirects to the
  dashboard, and older "staff" entries in the activity log still display.
  Phase 2 (2026-09-21): migration 11 removed the staff tables and functions
  from the live database. The owner confirmed the staff data was not needed,
  so none was kept. Do not add staff features back.
- **Earlier database drift resolved:** the undocumented staff redesign that
  existed only in the live database (`staff_payments`,
  `generate_staff_salaries`, `log_staff_payment_activity`) was removed by
  migration 11.
- **Migration history:** Supabase's migration history starts at
  `11_remove_staff` (applied 2026-09-21). Migrations 00-10 were run by hand in
  the SQL Editor before that and are not listed there.
- **The database can be rebuilt from migrations alone.** Since migration 12
  (2026-09-22) every access rule is in `supabase/migrations/`; the separate
  file `owner-auth-rls.sql` was removed. A database built from migrations
  00-12 matches the live one, except two known leftovers (backlog: column
  defaults and live updates on `owner_profiles`). Migration 12 was not run on
  the live database, which already had exactly these rules.
- **Test vs real database (owner's decision, 2026-09-22):** the current
  Supabase project is for testing only; no real person's details go into it.
  When the first real client starts, a new, clean Supabase project is built
  from the migrations for real use.
- **API keys:** Supabase is deprecating the legacy anon/service_role keys by
  the end of 2026. The site still uses the legacy anon key; key rotation is
  pending.

## 4. Known issues backlog (2026-09 review, not fixed yet)

- Payments and tenants are each loaded with a single request. Supabase's API
  returns at most 1,000 rows per request, so larger tables get silently cut off.
- The billing job only creates bills when it runs on the 1st. One failed run
  (this happened on 2026-06-01) skips that month's bills.
- A new tenant's first bill is always for the current month and due on the
  10th, so check-ins after the 10th are overdue immediately.
- Checkout is blocked while any bill is unpaid, yet the settlement screen
  suggests deducting arrears from the deposit. Deposit adjustments and refunds
  cannot be recorded.
- A bill and its payment are the same row; partial payments split rows. There
  is no separate receipt, and cash vs UPI is not recorded.
- Room occupancy is a stored counter maintained by hand in several functions.
- The login listener reloads all data on every auth event and signs the owner
  out if any load fails.
- Dashboard "Collected (This Month)" counts paid bills by billing month, not
  money received during the month.
- The hostel profile screen can change `rating` and can overwrite
  `total_rooms` with a stale value.
- There are no automated tests.

## 5. Commands

```bash
npm run lint    # must be clean before every commit
npm run build   # must succeed before every commit
npm run dev     # local development server
```
