# Yecny Bookkeeping OS — Launch Checklist (Internal)

Target: **Internal team launch next week**

This is a practical checklist focused on **stability, permissions, backups, and recurring automation**.

---

## 1) Freeze scope (today)
- [ ] No new features until launch (only bug fixes / polish).
- [ ] Pick the “go-live” URL/host (ex: `http://10.0.0.237` or `http://pi.local`).
- [ ] Decide where uploads/docs live (local disk now, NAS later).

---

## 2) Security + config (today)
- [ ] Set `YB_SECRET_KEY` (JWT signing secret) in environment (.env or systemd EnvironmentFile).
- [ ] Set CORS origins via `YB_CORS_ORIGINS` (comma-separated), ex:
  - `http://10.0.0.237:5173,http://localhost:5173`
- [ ] Disable bootstrap risk:
  - [ ] Confirm `/api/auth/init-admin` only works when DB has **zero users** (patched).
- [ ] Confirm roles are correct in DB:
  - [ ] owner/admin: full access
  - [ ] manager/bookkeeper: only their clients (+ ClientUserAccess)
  - [ ] client: portal access only (if used)

---

## 3) Database + migrations (today)
- [ ] Make sure backend starts cleanly with your real DB:
  - [ ] `sqlite:////home/kruzer04/YBTM/YB-TM/yb_app.db`
- [ ] If you’re using Alembic migrations:
  - [ ] `alembic upgrade head`
- [ ] Take a pre-launch backup of DB + docs (see backup script below).

---

## 4) Permissions “smoke test” (today/tomorrow)
Create 4 users:
- [ ] Owner (full access)
- [ ] Admin (full access)
- [ ] Manager (assigned to a client)
- [ ] Bookkeeper (assigned to a client)

Verify:
- [ ] Bookkeeper can open **Clients list** (only assigned clients).
- [ ] Bookkeeper can open a client profile and see:
  - [ ] Accounts tab
  - [ ] Documents list + download (only for their client)
  - [ ] Onboarding tab (unblocked tasks)
  - [ ] Tasks tab (tasks for their client or assigned)
- [ ] Manager can see *their* client and onboarding tasks for that client.
- [ ] Owner/Admin can see everything.

---

## 5) Recurring tasks automation (tomorrow)
Goal: recurring rules generate tasks automatically without duplicates.

- [ ] When a client is created (or intake converted), default recurring rules are created AND:
  - [ ] the **first task** is created
  - [ ] the rule’s `next_run` is advanced (patched)
- [ ] Install a scheduled recurring runner:
  - [ ] `python -m app.run_recurring` daily (or systemd timer)
- [ ] Run it once manually and confirm:
  - [ ] tasks generated
  - [ ] `recurring_tasks.next_run` moves forward
  - [ ] no duplicates for same due date

---

## 6) Backups (tomorrow)
- [ ] Set up nightly backups:
  - [ ] DB copy
  - [ ] docs folder archive
- [ ] Store backups somewhere safe (external drive or NAS).
- [ ] Test restore:
  - [ ] Replace DB with backup copy
  - [ ] Confirm backend starts and clients load

---

## 7) Deployment (this week)
Option A (simple internal): run backend via systemd on the Pi, frontend via Vite/build served by nginx.

- [ ] Backend systemd service:
  - [ ] `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] Frontend:
  - [ ] Dev server for now: `npm run dev -- --host`
  - [ ] Or build + serve static (recommended once stable)
- [ ] Confirm the frontend can login and keep cookies.

---

## 8) Launch day steps
- [ ] Take a DB + docs backup (again).
- [ ] Confirm recurring runner and backups are enabled.
- [ ] Import clients/accounts if needed (scripts included).
- [ ] Create staff users and assign manager/bookkeeper for each client.
- [ ] Do a 30-minute team “walkthrough”:
  - Clients → Accounts → Docs → Tasks → Onboarding
- [ ] Start using it on 3–5 real clients first (soft launch), then roll out to all.

---

# Scripts included in this patch
- `yb-backend/app/run_recurring.py` — daily recurring rule runner
- `yb-backend/app/backup_nightly.py` — timestamped backups (DB + docs)
- `yb-backend/app/import_clients.py` — import from the “YB Database - Clients.csv” style export
- `yb-backend/app/import_accounts.py` — import accounts export

# Suggested systemd units (optional)
See `deploy/` folder for examples.

