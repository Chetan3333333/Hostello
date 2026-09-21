# How changes are made to Hostello

Adopted 2026-09-20. `main` deploys to the live website automatically, so every
change follows these steps.

## The steps

1. **Proposal.** Describe the problem, the root cause, the exact files, any
   database impact, the risk and the rollback. The owner approves or rejects it.
2. **Implementation** on the `claude` branch. Run `npm run lint` and
   `npm run build` before every commit. Test database changes on a
   non-production database.
3. **Review.** The owner sees the full diff and every commit message and
   approves them before anything is pushed.
4. **Delivery.** The owner pushes `claude` (or fetches it from a bundle, see
   below), opens a pull request `claude → main` on GitHub, and merges it with
   **"Create a merge commit"**. Never use "Squash", which would merge the
   detailed messages into one. Merging deploys the website.
5. **Database (only if the change has a migration).** Run it on a test
   database first, then take a backup of production, then run it on production.
6. **Checks after deploy.** Follow the manual checks listed in the commit
   message.
7. **Next change.** `claude` is brought up to date with `main` before the next
   change starts.

## Commit message format

```
type(area): one-line summary

Branch: claude — prepared by <who>, approved by <who> on <date>

PROBLEM        What went wrong, as the hostel owner would experience it
ROOT CAUSE     Exact file/function and why it happened
CHANGE         What changed, file by file
DATABASE       Migration and rollback file names, or "None"
RISK/ROLLBACK  What could go wrong and the exact steps to undo it
VERIFIED BY    Checks that were run, plus manual checks for the owner
```

Describe only what the diff actually does. Plans and intentions belong in the
proposal, not in the commit message.

## Database migrations

- One new file per change: `supabase/migrations/NN_short_name.sql`, numbered
  after the last existing file.
- Every migration has a rollback: `supabase/rollbacks/NN_short_name.down.sql`.
- Write them so they are safe to run twice (`if not exists` / `if exists`).
- Never edit a migration that has already been applied; add a new one instead.
- Deploy order: a migration must not break the website that is currently live.
  If it would, ship the code change first and the migration afterwards.

## Receiving changes as a git bundle

A bundle is a single file that carries the `claude` branch with all commits and
messages. Run these in your Hostello folder (PowerShell or Git Bash):

```bash
# 1. Only if `git status` shows uncommitted changes: set them aside safely
git stash push -u -m "local changes before claude bundle"

# 2. Start from the latest main
git switch main
git pull

# 3. Load the branch and tags from the bundle file
git fetch <path-to-file>.bundle claude:claude
git fetch <path-to-file>.bundle "refs/tags/*:refs/tags/*"

# 4. Review what is new
git log --oneline main..claude

# 5. Publish the branch and the tags, then open the pull request on GitHub
git push origin claude
git push origin --tags
```

Your stashed changes stay available: `git stash list` shows them and
`git stash pop` brings them back.

## Undoing a change

- **Code:** on GitHub, open the merged pull request and click **Revert**. That
  creates a new pull request which undoes it; merging it redeploys the
  previous behaviour.
- **Database:** run the matching file in `supabase/rollbacks/`, after a backup.
- **Reference point:** the tag `baseline-2026-09-20` marks `main` as it was
  before this process began.
