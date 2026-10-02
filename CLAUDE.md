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

## 3. Current state (updated 2026-10-02)

- **Not in real use yet.** As of 2026-09-19 the live database held the demo
  dataset (all seeded tenants unchanged, demo listing "Sri Sai Boys Hostel")
  plus a few entries added through the app (see "Test vs real database"
  below).
- **Staff section removed** (owner's decision, 2026-09-20). Code removed in
  Phase 1; migration 11 removed the tables and functions. Do not add it back.
- **A real client has accepted the app** (2026-09-30). The plan: keep the
  current Supabase project as the practice one and build a clean database for
  real hostels. Nothing real has been entered yet; the live database still holds
  the demo dataset.
- **Goal: many hostels.** Build everything so more hostels and owners can be
  added later, but get one hostel working perfectly first.
- **Rent rules (owner's decision):** calendar month, full month, due on the
  10th, no proration. Do not change without asking.
- **Supabase plan:** Free for the first 2-3 hostels, then Pro. Free pauses after
  a week of no use and has no automatic backups.
- **Migration history** in Supabase starts at 11; migrations 00-10 were run by
  hand in the SQL Editor before that. Everything from 11 onward is recorded.
- **Access rules** now live in migration 12, so a database can be rebuilt from
  this repository alone.
- **API keys:** Supabase is deprecating the legacy anon/service_role keys by the
  end of 2026, and the current keys have been exposed in chat. They belong to
  the practice database only; the real client gets a fresh project with fresh
  keys. Rotation is still pending.

### Fixed since 2026-09-20 (do not re-introduce)
- Migration 12: owner access rules moved into the numbered migrations.
- Migrations 13, 14 and the Payments screen: Undo asks for confirmation; a bill
  cannot be reopened for a tenant who has checked out; Delete was replaced by
  Cancel, which keeps the bill visible; reversals and cancellations are written
  to the activity history; a cancelled bill can be replaced by a corrected one.
- Migration 15: renaming a room only updates the current month's unpaid bills of
  tenants living there now. History is never rewritten.
- Migration 16: the nightly job creates any missing rent bill for the current
  month on any night, not only the 1st, and warns in the history when it runs
  late. Rent rules unchanged.
- Migration 17 and the Payments screen: extra charges (electricity, fines) can
  be added for the same month through the existing Record Payment box, with the
  reason in the Note. Each bill carries a kind, rent or extra; rent stays one per
  month and the nightly job counts rent only.
- Migration 18: the database counts room occupancy itself; a wrong value is
  corrected as it is written. scripts/fixRoomStatuses.js was deleted.
- Migration 19: the database refuses to move a checked-out tenant, to change the
  amount of a settled bill, to move a bill to another tenant or month, or to
  create a bill for a tenant who has left. Collecting arrears after checkout
  still works.
- Surprise logouts: the app no longer reloads everything on every quiet login
  renewal, and a failed load shows Retry instead of signing the owner out.

## 4. Known issues backlog (not fixed yet)

Before the first real client:
- A clean database for real hostels, with the owner's own login and real email
  (the current login is the placeholder owner@hostello.com).
- Cash / UPI / Bank is not asked for when marking a bill paid, although the
  database column exists.
- No backup routine; the Free plan has none.
- Refreshing a page may show 404 on the host; needs testing and possibly a
  rewrite rule.
- The hostel profile screen can overwrite the room count with a stale value, the
  hostel name can be saved blank, and the owner can edit the public rating.
- The public page still advertises the demo hostel.
- Public sign-ups are probably still allowed in Supabase; only owners need
  accounts.

Soon after launch:
- Bills and receipts are still the same record: a part payment rewrites the bill
  amount and splits it, deposits are only a number on the tenant form, and
  advance payments are refused.
- "Collected (This Month)" counts bills by billing month, not money received.
- No "Forgot password" page.
- Payments and tenants are each loaded in one request; Supabase returns at most
  1,000 rows, silently.
- Other devices do not refresh automatically; only the activity feed is live.
- Dates come from the device clock rather than India time.
- No automatic tests and no nightly health check.
- Small screen issues: floors and room numbers sort as text, the chart shows
  "0k" for small amounts, pop-ups close on an outside tap and ignore Escape,
  ground-floor rooms (floor 0) cannot be added, the bell icon is decorative,
  and the WhatsApp reminder has no UPI id.

## 5. Commands

```bash
npm run lint    # must be clean before every commit
npm run build   # must succeed before every commit
npm run dev     # local development server
```
