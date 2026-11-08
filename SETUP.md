# FlashSale — Setup & Onboarding Guide

Everything a teammate needs to go from a fresh laptop to a running stack, plus the
Git workflow for contributing on your own branch.

> Read this top to bottom once (~15 minutes). Afterwards, day-to-day startup is
> the 3-command block in [§7](#7-run-the-stack-daily-workflow).

---

## 1. What you will be running

| # | Process | Port | Purpose |
|---|---|---|---|
| 1 | PostgreSQL | 5432 | durable state (users, events, bookings, payments) |
| 2 | Redis | 6379 | BullMQ queue broker (later: atomic inventory) |
| 3 | Express API | 4000 | REST API |
| 4 | Booking worker | – | consumes booking jobs (start as many as you like) |
| 5 | Angular dev server | 4200 | the SPA |

There is no single "start" command because the API and the workers are
**separate processes by design** — that is what makes the workers horizontally
scalable. Locally you run them in separate terminals.

---

## 2. Versions

### Tested and known-good

| Tool | Version used to build/verify | Minimum | Notes |
|---|---|---|---|
| Node.js | **v18.20.8** | **18.19.0** | Node 20 LTS or 22 LTS recommended. **Do not jump to Angular 20 unless Node ≥ 20.19.** |
| npm | 10.8.2 | 9.x | ships with Node 18/20/22 |
| PostgreSQL | **18.4** | 14 | any recent release works |
| Redis | **8.2.10** (via Memurai 8.2.0) | 6.2 recommended, 5.0 works | BullMQ warns below 6.2 |
| Git | 2.40+ | 2.23 | `git switch` / `git restore` used in this guide |

### Backend `package.json` (exact ranges)

```
@prisma/client  ^6.19.3     express       ^4.22.3
prisma (dev)    ^6.19.3     zod           ^3.25.76
bullmq          ^5.81.5     pino          ^9.14.0
ioredis         ^5.11.1     pino-pretty   ^11.3.0 (dev)
jsonwebtoken    ^9.0.3      bcryptjs      ^3.0.3
helmet          ^8.3.0      cors          ^2.8.6
dotenv          ^16.6.1     vitest        ^3.2.7  (dev)
nodemon         ^3.1.14 (dev)   supertest ^7.3.2 (dev)
```

### Frontend `package.json` (exact ranges)

```
@angular/*             ^19.2.0     @angular/cli (dev)  ^19.2.27
typescript (dev)       ~5.7.2       rxjs                ~7.8.0
zone.js                ~0.15.0      tailwindcss (dev)   ^3.4.19
postcss (dev)          ^8.5.32      autoprefixer (dev)  ^10.6.2
```

> **Why Angular 19 and not 20?** Angular 20 requires Node ≥ 20.19. The project was
> built on Node 18, so it is pinned to Angular 19.2 — which already provides
> standalone components, signals, functional guards/interceptors and `@if`/`@for`.
> If you run Node 20.19+/22+, upgrading is `npm i @angular/*@20 @angular/cli@20`
> with no code changes for the features used here.

---

## 3. Install the prerequisites

### Windows (PowerShell)

```powershell
# Node.js 20 LTS (or 22 LTS). Verify: node --version
winget install OpenJS.NodeJS.LTS

# Git
winget install Git.Git

# PostgreSQL (installs the server + pgAdmin + psql)
winget install PostgreSQL.PostgreSQL.18
```

**Redis on Windows** — pick one:

| Option | Command / action |
|---|---|
| **Memurai** (native service, what this project was verified on) | install the Developer MSI from memurai.com → runs on 6379 automatically |
| **Docker Desktop** | `docker run -d --name flashsale-redis -p 6379:6379 redis:7-alpine redis-server --appendonly yes` |
| **WSL 2** | `wsl --install -d Ubuntu`, then `sudo apt install -y redis-server && sudo service redis-server start` |

### macOS

```bash
brew install node@20 postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

### Linux (Debian/Ubuntu)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql redis-server
sudo systemctl enable --now postgresql redis-server
```

Verify everything:

```powershell
node --version        # v20.x or v22.x (v18.19+ also fine)
npm --version
psql --version        # or the full path on Windows, see below
redis-cli ping        # PONG  (memurai-cli ping if using Memurai)
```

On Windows `psql` is usually **not** on `PATH`. Use the full path or add it:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"     # per-shell
```

---

## 4. Clone the repository

```powershell
git clone <REPOSITORY_URL> "Ticket Flash sale"
cd "Ticket Flash sale"
git switch main
```

Windows note: this repo lives in a folder with a space in its name. Always quote
the path (`cd "Ticket Flash sale"`).

---

## 5. Create the database

Pick a password **without** characters like `@ : / ? # %` — they have to be
percent-encoded inside a URL. Example: `FlashSaleDev2026`.

```powershell
# prompts for the postgres password
psql -U postgres -h localhost -c "CREATE DATABASE flashsale;"
```

`CREATE DATABASE` = success. `already exists` = also fine.

### Optional but recommended: a dedicated app user

Running the app as `postgres` (superuser) is a habit worth breaking early.

```sql
CREATE ROLE flashsale_app WITH LOGIN PASSWORD 'FlashSaleDev2026';
GRANT ALL PRIVILEGES ON DATABASE flashsale TO flashsale_app;
\c flashsale
GRANT ALL ON SCHEMA public TO flashsale_app;
```

---

## 6. Configure the backend environment

```powershell
cd backend
Copy-Item .env.example .env
```

Then edit `backend\.env`:

```ini
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://flashsale_app:FlashSaleDev2026@localhost:5432/flashsale?schema=public
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<paste a 48+ character random string>
JWT_EXPIRES_IN=1h
CORS_ORIGIN=http://localhost:4200
LOG_LEVEL=info
QUEUE_CONCURRENCY=5
RESERVATION_TTL_SECONDS=600
EXPIRATION_SWEEP_INTERVAL_MS=60000
```

Generate the secret (never reuse someone else's):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`JWT_SECRET` shorter than 32 characters makes the API refuse to boot — that is
intentional fail-fast behaviour, not a bug.

Then install and migrate:

```powershell
npm ci                       # reproducible install from package-lock.json
npx prisma generate          # generates the typed client
npx prisma migrate deploy    # creates tables, indexes, FKs, CHECK constraints
```

Expected tail of the migration output:

```
Applying migration `20261108120000_init`
All migrations have been successfully applied.
```

---

## 7. Run the stack (daily workflow)

Four terminals, all starting in the repo root unless noted.

**Terminal 1 — API**

```powershell
cd backend
npm run dev
```
→ `FlashSale API listening on http://localhost:4000`

**Terminal 2 — booking worker**

```powershell
cd backend
npm run worker
```
→ `Booking worker started`

**Terminal 3 — expiration worker (optional for now)**

```powershell
cd backend
npm run worker:expiration
```

**Terminal 4 — frontend**

```powershell
cd frontend
npm ci
npm start
```
→ open **http://localhost:4200**

> Open `localhost`, **not** `127.0.0.1`. They are different browser origins, and
> the API's CORS allow-list contains `http://localhost:4200`. If you must use a
> different origin/port, add it to `CORS_ORIGIN` (comma-separated).

Scale workers whenever you want — each one is an independent process:

```powershell
1..3 | ForEach-Object { Start-Process node -ArgumentList 'src/workers/booking.worker.js' }
```

---

## 8. Verify your setup

Run these in order; each has an expected result.

| Step | Command | Expected |
|---|---|---|
| Redis reachable | `Test-NetConnection localhost -Port 6379 -InformationLevel Quiet` | `True` |
| API alive | `curl.exe -s http://localhost:4000/api/v1/health/live` | `"status":"alive"` |
| API ready | `curl.exe -s http://localhost:4000/api/v1/health/ready` | `"isReady":true`, all three checks `up` |
| Backend tests | `cd backend; npm test` | `12 passed` |
| Frontend build | `cd frontend; npm run build` | `Application bundle generation complete` |
| UI | http://localhost:4200/events | event cards or "No events on sale" |

### First admin account

Registration always creates a `USER`. Promote yourself once:

```powershell
psql -U postgres -d flashsale -c "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

(or run the same SQL in pgAdmin → Query Tool)

**Then sign out and sign in again** — the role is stored inside the JWT, so the
existing token still claims `USER`.

### End-to-end smoke test

1. `/register` → create a user
2. `/events` → open the event → **Book tickets** → quantity 3 → **Confirm**
3. You land on `/bookings/:id` with a `Processing` badge and polling
4. Terminal 2 logs `Booking job received` → `Booking job completed ... "status": "SKIPPED"`
5. `/bookings` lists the booking; as admin, `/admin` shows counters + inventory

`SKIPPED` is correct for the current phase: the job travels producer → Redis →
worker, but inventory reservation (Redis + Lua) is not implemented yet, so the
booking stays `PROCESSING`.

---

## 9. Git workflow (you work on your own branches)

### One-time branch setup

```powershell
git switch main
git pull --ff-only
git switch -c feat/<short-description>     # e.g. feat/redis-atomic-inventory
```

Branch prefixes: `feat/` new capability · `fix/` bug · `docs/` documentation ·
`test/` tests only · `chore/` tooling · `refactor/` no behaviour change.

### Commit style

```
feat(bookings): reserve inventory atomically with a Lua script
fix(auth): return 401 instead of 500 on expired tokens
docs(setup): add macOS install steps
```

Keep commits small and self-contained. Run before committing:

```powershell
cd backend; npm test
cd ..\frontend; npm run build
git status            # never stage .env, node_modules, dist
```

### Publish your work

```powershell
git push -u origin feat/redis-atomic-inventory
# then open a Pull Request on GitHub against `main`
```

### Keep your branch current

```powershell
git fetch origin
git rebase origin/main        # resolve conflicts locally, then:
git push --force-with-lease   # only on your own feature branch
```

### Never commit

`.env` · `node_modules/` · `dist/` · `.angular/` · any credential, token or dump.
They are already in `.gitignore` — if `git status` shows them, stop and fix it
instead of committing.

`.env.example` **is** committed and must stay in sync with `config/env.js` when
you add a variable.

### Database schema changes

```powershell
cd backend
# 1. edit prisma/schema.prisma
# 2. create the migration (needs a working DATABASE_URL)
npx prisma migrate dev --name add_payment_reference
# 3. commit the generated prisma/migrations/<timestamp>_<name>/ folder
```

Teammates then run `npx prisma migrate deploy` after pulling. Never hand-edit an
already-committed migration; add a new one.

If you add CHECK constraints (Prisma cannot model them), append them to the new
migration SQL — see the block at the end of
`backend/prisma/migrations/20261108120000_init/migration.sql`.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `P1000 Authentication failed` | Wrong user/password in `DATABASE_URL`, or an unencoded special character (`@` → `%40`). Verify with `psql -U <user> -h localhost -d postgres -c "select 1"`. |
| `P1003 Database ... does not exist` | Run the `CREATE DATABASE flashsale;` step. |
| `P1001 Can't reach database server` | PostgreSQL not running / wrong port. `Get-Service *postgres*`. |
| `invalid environment configuration: JWT_SECRET` | Secret < 32 chars. Regenerate and restart the API. |
| Browser: `blocked by CORS policy` | You opened `127.0.0.1:4200`. Use `localhost:4200`, or add the origin to `CORS_ORIGIN`. |
| `/health/ready` → `503`, `redis: down` | Redis/Memurai not running. The API boots anyway on purpose so the probe can report it. |
| `ECONNREFUSED ::1:6379` messages | Redis bound to IPv4 only (normal on Windows). The project uses `127.0.0.1`, which works. |
| BullMQ: `minimum Redis version of 6.2.0` | Old Redis build — upgrade, or ignore for local queue testing. |
| `ng` refuses to start / unsupported Node | Angular 19 needs Node ≥ 18.19. Node < 18.19 won't work at all; Node ≥ 20.19 is required only for Angular 20+. |
| Port already in use | `netstat -ano \| findstr :4000` → `Stop-Process -Id <pid>`, or change `PORT` (and `CORS_ORIGIN` / `environment.ts` if you move the frontend). |
| Frontend shows "Cannot reach the API" | API not running on 4000, or you are on the wrong origin (CORS). |
| Prisma engine download blocked by proxy | Allow `binaries.prisma.sh`, or copy `node_modules/@prisma/engines` from a colleague. |

Where to look when something is off:

```powershell
curl.exe -s http://localhost:4000/api/v1/health/ready    # dependency state
# API / worker logs are on stdout of their terminals (pino, pretty-printed in dev)
```

---

## 11. Handy commands

| Command | Where | What |
|---|---|---|
| `npm run dev` | backend | API with nodemon auto-reload |
| `npm start` | backend | API without reload |
| `npm run worker` | backend | booking worker |
| `npm run worker:expiration` | backend | reservation sweeper |
| `npm test` / `npm run test:watch` | backend | Vitest (+ Supertest) |
| `npx prisma studio` | backend | browse the database in a browser |
| `npx prisma migrate deploy` | backend | apply committed migrations |
| `npm start` | frontend | Angular dev server on 4200 |
| `npm run build` | frontend | production bundle in `dist/frontend` |
| `docker compose up --build` | repo root | everything in containers (needs Docker) |

---

## 12. What's next (context for new contributors)

Phase 0 (this commit) is intentionally a skeleton: HTTP intake, durable booking
rows, queue plumbing, health checks, UI. The concurrency-critical parts have
named seams so they can be added without redesign:

| Upcoming | File to touch |
|---|---|
| Atomic Redis + Lua inventory reservation | `backend/src/services/inventory.service.js` |
| Worker transitions `PROCESSING → RESERVED` with CAS | `backend/src/workers/booking.worker.js`, `booking.service.js` |
| Reservation expiry | `backend/src/workers/expiration.worker.js` |
| Payment intent + webhook | `backend/src/services/payment.service.js` |
| Rate limiting, load testing, metrics | `backend/src/app.js`, `tests/`, `/health` |

Architecture, API reference, database design and the state machine are documented
in [README.md](./README.md).
