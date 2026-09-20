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
- Database triggers (migration 09) record changes to rooms, tenants, payments
  and staff in `activity_logs`. The app can read the log but cannot edit or
  delete it.
- Billing: the pg_cron job `daily_payment_automation` runs
  `process_daily_payments()` every day at 00:00 IST. It marks unpaid bills past
  their due date as overdue and, on the 1st of the month only, creates that
  month's bill for every active tenant (due on the 10th).

## 3. Current state (updated 2026-09-20)

- **Not in real use yet.** As of 2026-09-19 the live database held the demo
  dataset (all seeded tenants unchanged, demo listing "Sri Sai Boys Hostel")
  plus a few entries added through the app. Proposed: go live from a clean
  database.
- **Staff section removed** (owner's decision, 2026-09-20).
  Phase 1 (done): removed from the code. `/owner/staff` now redirects to the
  dashboard, and older "staff" entries in the activity log still display.
  Phase 2 (pending): after Phase 1 is verified in production and a backup
  exists, a new migration removes the staff tables and functions from the
  database. Until then they remain in the database, unused by the app.
  Do not add staff features back.
- **Known database drift:** the live database contains objects that no file in
  this repository creates: table `staff_payments`, functions
  `generate_staff_salaries` and `log_staff_payment_activity`, extra `staff`
  columns, and no `staff.balance` column or `adjust_staff_balance` function.
  Phase 2 removes all of it.
- **Access rules are not all in migrations.** The row-level security policies
  for `hostels`, `tenants`, `payments`, `staff` and `owner_profiles` live in
  `supabase/owner-auth-rls.sql`. A database built from `migrations/` alone
  denies everything until that file is also run.
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
