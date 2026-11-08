# FlashSale — Scalable Ticket Flash-Sale System

A production-oriented ticket booking platform designed around a single hard
guarantee: **never sell more tickets than exist**, even when thousands of users
hit "book" at the same moment.

This repository currently contains **Phase 0 — the base project**. It boots, it
persists data, it queues jobs, and it has the seams (interfaces + module
boundaries) where the concurrency-critical logic will be added incrementally.

---

## 1. What is implemented today

| Area | Status |
|---|---|
| Express API with modular structure | ✅ |
| PostgreSQL + Prisma schema, initial migration, CHECK constraints | ✅ |
| Redis connection + health probing | ✅ |
| BullMQ booking queue + retry policy | ✅ |
| Independently runnable booking worker and expiration worker (skeletons) | ✅ |
| JWT auth (register / login / me), bcrypt hashing, ADMIN + USER roles | ✅ |
| Events: create (ADMIN), list, detail, inventory view (ADMIN) | ✅ |
| Bookings: submit (202 + durable row + enqueue), poll status, my bookings, admin overview | ✅ |
| Booking status state machine with compare-and-set transitions | ✅ |
| Health endpoints: live / ready / summary | ✅ |
| Angular frontend: 8 pages, guards, interceptors, signals, polling | ✅ |
| Docker Compose (postgres, redis, migrate, api, worker, expiration, frontend) | ✅ |
| Backend test suite (Vitest + Supertest) | ✅ (12 tests) |

Deliberately **not** implemented yet (see [§12](#12-roadmap-and-extension-points)):
atomic Redis/Lua inventory reservation, payment gateway, reservation expiration
logic, idempotent replay, rate limiting, load testing, Prometheus/Grafana.

Until the inventory phase lands, a submitted booking stays in `PROCESSING` — the
worker receives the job and completes it as `SKIPPED`. That is intentional: the
skeleton must not pretend to reserve tickets with a non-atomic read-modify-write.

---

## 2. Architecture

```
                       ┌──────────────────────────┐
   browser  ──────────►│  Angular 19 SPA (:4200)  │
                       │  guards · interceptors   │
                       │  signals · polling       │
                       └────────────┬─────────────┘
                                    │ HTTP + Bearer JWT
                                    ▼
                       ┌──────────────────────────┐
                       │  Express API (:4000)     │        stateless → scale N
                       │  validate → persist →    │
                       │  enqueue → 202 Accepted  │
                       └───┬───────────────┬──────┘
                           │               │
              durable write│               │ XADD / BullMQ
                           ▼               ▼
                 ┌─────────────────┐  ┌──────────────────┐
                 │  PostgreSQL     │  │  Redis           │
                 │  users/events   │  │  queue "booking" │
                 │  bookings/pay   │  │  (future: atomic │
                 │  source of truth│  │   inventory)     │
                 └────────▲────────┘  └────────┬─────────┘
                          │                    │ BRPOPLPUSH
                          │                    ▼
                          │        ┌────────────────────────┐
                          │        │  Worker processes      │
                          └────────┤  booking.worker.js  ×N │
                                   │  expiration.worker.js  │
                                   └────────────────────────┘
```

### Why this shape

* **The API never does long work.** It validates, writes a durable booking row,
  enqueues a job, and returns `202` in a few milliseconds. Arrival rate during a
  flash sale is far above the rate at which inventory can be coordinated, so the
  queue absorbs the burst instead of the database.
* **Workers are separate OS processes.** They can be scaled horizontally
  (`--scale worker=3`), restarted independently, and they never serve HTTP.
* **PostgreSQL and Redis are not one transaction.** The code assumes a crash can
  happen between "row written" and "job enqueued", and compensates: if the
  enqueue fails the booking is marked `FAILED` with `failureReason` and the client
  gets `503`. The reverse case (job exists, row missing) is impossible because the
  row is written first.

### Booking request flow (today)

```
POST /api/v1/bookings
  → Zod validation (eventId uuid, quantity 1..10)
  → cheap "sold out?" read (friendly error only — NOT authoritative)
  → INSERT bookings (status = PROCESSING, Idempotency-Key stored)
  → Queue.add("reserve-tickets", { bookingId, ... }, { jobId: bookingId })
  → 202 { bookingId, status: "PROCESSING", pollUrl }
  → client polls GET /api/v1/bookings/:id
```

---

## 3. Technology stack and why

| Technology | Role | Why this choice |
|---|---|---|
| Node.js + Express 5 | HTTP API | Non-blocking I/O suits an I/O-bound gateway; huge ecosystem; minimal ceremony. |
| Zod | Request validation | One schema doubles as the TypeScript contract and runtime guard; strips unknown keys. |
| PostgreSQL + Prisma | Durable state | ACID guarantees for money and bookings; Prisma gives typed queries and migration history. |
| Redis | Queue broker (+ future inventory) | Single-threaded command execution makes Lua scripts atomic — the foundation of oversell prevention. |
| BullMQ | Job queue | Retries with exponential backoff, delayed/repeatable jobs, job-id deduplication, worker concurrency. |
| JWT + bcrypt | Auth | Stateless tokens let the API scale horizontally; bcrypt (cost 12) keeps stolen hashes expensive. |
| Angular 19 + Tailwind | Frontend | Standalone components, signals, functional interceptors, lazy routes; Tailwind keeps styling local. |
| Docker Compose | Local infra | One command brings up Postgres, Redis, API, workers and the SPA. |
| Vitest + Supertest | Backend tests | Fast ESM-native runner; Supertest exercises real HTTP routing without binding a port. |

> **Angular version note.** This machine runs Node.js 18.20.8. Angular 20+ requires
> Node ≥ 20.19, so the frontend is pinned to **Angular 19.2** — the newest release
> that supports Node 18 and already has standalone-by-default, signals,
> functional guards/interceptors and `@if`/`@for` control flow. Upgrading is a
> dependency bump (`npm i @angular/*@20`) plus installing Node 20.19+; no code
> changes are required for the features used here.

---

## 4. Repository layout

```
Ticket Flash sale/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/20261108120000_init/migration.sql   # tables + CHECK constraints
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js            # Zod-validated configuration, fail-fast at boot
│   │   │   ├── database.js       # single PrismaClient per process
│   │   │   └── redis.js          # BullMQ connection options + shared client
│   │   ├── modules/
│   │   │   ├── auth/             # auth.controller / auth.service / auth.routes / auth.validation
│   │   │   ├── events/           # event.controller / event.service / event.routes / event.validation
│   │   │   ├── bookings/         # booking.controller / booking.service / booking.routes / booking.validation
│   │   │   └── health/           # health.routes + health.service (readiness probes)
│   │   ├── queues/
│   │   │   ├── booking.queue.js         # lazy BullMQ Queue + retry contract
│   │   │   └── expiration.queue.js      # repeatable sweep scheduler
│   │   ├── workers/
│   │   │   ├── booking.worker.js        # consumes "reserve-tickets" jobs
│   │   │   └── expiration.worker.js     # sweeps abandoned reservations
│   │   ├── services/
│   │   │   ├── inventory.service.js     # ⭐ the single seam for inventory
│   │   │   └── payment.service.js       # ⭐ payment extension point
│   │   ├── middlewares/                 # authenticate / requireRole, error handler, validate
│   │   ├── constants/booking-status.js  # state machine (pure, unit-tested)
│   │   ├── utils/                       # logger, errors, jwt, asyncHandler
│   │   ├── app.js                       # builds the Express app (testable)
│   │   └── server.js                    # process entry: connect, listen, graceful shutdown
│   ├── tests/                           # booking-status.test.js, health.test.js
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── core/
│       │   │   ├── guards/       # authGuard, adminGuard, guestGuard
│       │   │   ├── interceptors/ # auth (Bearer), error (401/network)
│       │   │   ├── services/     # auth.service, notification.service
│       │   │   ├── models/       # api / user / event / booking contracts
│       │   │   └── utils/        # api-error message extraction
│       │   ├── shared/
│       │   │   ├── components/   # spinner, empty-state, status-badge, toast-container
│       │   │   ├── pipes/        # money.pipe (minor units → currency)
│       │   │   └── directives/   # autofocus.directive
│       │   ├── features/
│       │   │   ├── auth/components/       # login, register
│       │   │   ├── events/components/     # list, detail  + events/services/event.service.ts
│       │   │   ├── bookings/components/   # booking-form, booking-status, my-bookings + services
│       │   │   └── admin/components/      # dashboard + admin/services/admin.service.ts
│       │   ├── app.routes.ts     # lazy-loaded route table
│       │   ├── app.config.ts     # providers: router, http + interceptors
│       │   └── app.component.*   # shell: header, nav, outlet, toasts
│       ├── environments/         # environment.ts / environment.production.ts
│       └── styles.css            # Tailwind layers + shared component classes
├── docker-compose.yml
└── README.md
```

**Structural deviations from the original outline (and why):**

* `modules/health/` instead of health handlers inside `app.js` — health logic
  (timeouts, degradation rules) is real logic that deserves tests.
* `frontend/api-error.ts` helper in `core/utils` — message extraction is shared by
  the interceptor and by page components; duplicating it would drift.
* `auth.service.ts` lives in `core/services`, not `features/auth/services` —
  guards, the interceptor and the app shell all depend on it; putting a shared
  singleton inside one feature forces other features to import that feature.

---

## 5. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | **18.19+** (20 or 22 recommended) | Angular 20+/Angular CLI 20 requires Node ≥ 20.19. |
| npm | 9+ | |
| PostgreSQL | 14+ | Tested against PostgreSQL 18. |
| Redis | **6.2+** recommended (5.0 works) | BullMQ warns below 6.2. Docker uses `redis:7-alpine`. |
| Docker + Compose | optional | Only needed for the all-in-one path. |

---

## 6. Quick start — local (no Docker)

### 6.1 Database

```bash
# create the database (adjust user/password to your installation)
psql -U postgres -c "CREATE DATABASE flashsale;"
```

### 6.2 Backend

```bash
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET (≥ 32 chars)
npx prisma generate
npx prisma migrate deploy     # applies prisma/migrations
npm run dev                   # http://localhost:4000
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 6.3 First admin

Registration always creates a `USER`. Promote the first admin once, then use that
account to create events:

```bash
psql -U postgres -d flashsale -c "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

Log out and back in so the new role is baked into a fresh JWT.

### 6.4 Workers

Each worker is an independent process — open two more terminals:

```bash
cd backend
npm run worker              # booking worker
npm run worker:expiration   # expiration sweeper
```

Scale out by simply starting more booking workers:

```bash
# PowerShell
1..3 | ForEach-Object { Start-Process node -ArgumentList 'src/workers/booking.worker.js' }
```

### 6.5 Frontend

```bash
cd frontend
npm install
npm start                   # ng serve → http://localhost:4200
```

`src/environments/environment.ts` points the SPA at `http://localhost:4000/api/v1`;
the backend allows `http://localhost:4200` through `CORS_ORIGIN`.

> Serve the app on `localhost`, not `127.0.0.1` — they are different origins for
> CORS purposes.

---

## 7. Quick start — Docker Compose

```bash
# optional but recommended: pin a real secret for the containers
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"

docker compose up --build
docker compose up --scale worker=3        # additional booking workers
```

| Service | URL / port | Purpose |
|---|---|---|
| frontend | http://localhost:4200 | Angular build served by nginx |
| backend | http://localhost:4000 | Express API |
| postgres | localhost:5432 | database `flashsale` |
| redis | localhost:6379 | queue broker |
| migrate | — | one-shot `prisma migrate deploy`, exits 0 |
| worker | — | booking jobs (scalable) |
| expiration | — | reservation sweeper |

Promote your admin inside the container:

```bash
docker compose exec postgres psql -U postgres -d flashsale \
  -c "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

---

## 8. Environment variables (`backend/.env`)

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `4000` | API port |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string used by Prisma |
| `REDIS_URL` | no | `redis://127.0.0.1:6379` | Redis connection string |
| `JWT_SECRET` | **yes** | — | ≥ 32 characters; boot fails otherwise |
| `JWT_EXPIRES_IN` | no | `1h` | Token lifetime |
| `CORS_ORIGIN` | no | `http://localhost:4200` | Allowed browser origin(s), comma-separated |
| `LOG_LEVEL` | no | `info` | pino level |
| `QUEUE_CONCURRENCY` | no | `5` | Jobs a single worker processes in parallel |
| `RESERVATION_TTL_SECONDS` | no | `600` | How long a reservation may hold tickets (phase 2) |
| `EXPIRATION_SWEEP_INTERVAL_MS` | no | `60000` | Sweeper cadence |

Frontend configuration lives in `src/environments/environment.ts`
(`apiUrl`) and is swapped for `environment.production.ts` on production builds
via `angular.json` `fileReplacements`.

---

## 9. Database design

```
users 1 ──── * bookings * ──── 1 events
  │                              │
  └────── * events (creator)     └── 1 payments
```

| Model | Key columns | Notes |
|---|---|---|
| `users` | `email` UNIQUE, `passwordHash`, `role` | bcrypt hash only; role enum `ADMIN`/`USER` |
| `events` | `capacity`, `reservedCount`, `priceCents`, `currency`, `startsAt` | availability = `capacity - reservedCount` |
| `bookings` | `status`, `quantity`, `unitPriceCents`, `totalPriceCents`, `idempotencyKey`, `reservedUntil`, `jobId` | `@@unique([userId, idempotencyKey])` |
| `payments` | `bookingId` UNIQUE, `provider`, `amountCents`, `status` | one payment per booking |

**Indexes that matter**

* `bookings(userId, createdAt)` — "my bookings" listing.
* `bookings(eventId, status)` — per-event reconciliation.
* `bookings(status, reservedUntil)` — the expiration sweep's access path.
* `events(startsAt)` — the public catalogue.

**Integrity enforced by the database** (Prisma cannot model CHECK constraints, so
they are appended to the migration):

```sql
events_capacity_positive        CHECK (capacity > 0)
events_reserved_within_capacity CHECK (reservedCount >= 0 AND reservedCount <= capacity)
events_price_non_negative       CHECK (priceCents >= 0)
bookings_quantity_valid         CHECK (quantity > 0 AND quantity <= 10)
bookings_total_matches          CHECK (totalPriceCents = quantity * unitPriceCents)
```

Application validation is the first line of defence; these constraints are the
last one — a buggy worker or a manual `psql` session cannot corrupt inventory.

### Two decisions worth calling out

1. **Money is integer minor units** (`priceCents`). Floats accumulate rounding
   error, and Redis Lua arithmetic is integer-only anyway. Formatting happens
   once, in the UI (`money.pipe.ts`).
2. **Both a Redis counter and `reservedCount` exist (soon).** Redis will be
   authoritative during the sale because it can decrement atomically; PostgreSQL
   keeps the auditable record so the counter can always be rebuilt
   (`inventory.service.syncInventoryFromDatabase`).

> If you change the schema with `prisma migrate dev`, re-add the CHECK constraints
> in the generated migration — Prisma does not emit them.

---

## 10. API reference

Base URL: `http://localhost:4000/api/v1`. All JSON. Errors use
`{ "error": { "code": "...", "message": "...", "details"?: ... } }`.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | service metadata (no dependencies touched) |
| GET | `/health/live` | — | liveness: process is alive |
| GET | `/health/ready` | — | readiness: PostgreSQL + Redis + queue; `200` or `503` |

```json
// GET /health/ready  (200)
{ "data": { "status": "ok", "isReady": true,
  "checks": { "database": {"status":"up","latencyMs":2},
              "redis": {"status":"up","latencyMs":1},
              "bookingQueue": {"status":"up","latencyMs":1} } } }
```

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | create account → `201` user + token |
| POST | `/auth/login` | — | → `200` user + token |
| GET | `/auth/me` | Bearer | current profile |

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"Password123","name":"Ticket Buyer"}'
```

### Events

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/events?take=20&includePast=false` | — | upcoming catalogue |
| GET | `/events/:id` | — | event detail with availability |
| POST | `/events` | ADMIN | create event (capacity, price in minor units) |
| GET | `/events/:id/inventory` | ADMIN | capacity / reserved / available + source |

```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Midnight Arena Tour","description":"500 seat flash sale",
       "venue":"Nehru Indoor Stadium","capacity":500,
       "startsAt":"2026-12-01T18:30:00.000Z","priceCents":250000,"currency":"INR"}'
```

### Bookings

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Bearer | submit request → `202 { bookingId, status, pollUrl }` |
| GET | `/bookings/:id` | owner/ADMIN | poll status |
| GET | `/bookings?take=50` | Bearer | my bookings |
| GET | `/bookings/admin/overview` | ADMIN | counters, revenue, inventory, recent bookings |

Optional header: `Idempotency-Key: <unique-string>` — stored on the booking.
Reusing a key currently returns `409 IDEMPOTENCY_KEY_REUSED`; full replay
(returning the original booking) arrives with the booking phase.

```bash
curl -i -X POST http://localhost:4000/api/v1/bookings \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: 4d1c9c1e-7f4e-4a1e-9f1a-2b3c4d5e6f70" \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<uuid>","quantity":2}'
# HTTP/1.1 202 Accepted
# Location: /api/v1/bookings/<bookingId>
# {"data":{"bookingId":"...","status":"PROCESSING","pollUrl":"/api/v1/bookings/..."}}
```

**Error codes:** `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 ·
`TOKEN_EXPIRED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `EMAIL_TAKEN` 409 ·
`EVENT_SOLD_OUT` 409 · `INVALID_STATUS_TRANSITION` 409 · `QUEUE_UNAVAILABLE` 503.

---

## 11. Booking lifecycle

```
                 ┌────────────┐
      created ──►│ PROCESSING │
                 └─────┬──────┘
            enqueue ok │      ┌────────── buy fails / queue down
                       ▼      ▼
                 ┌──────────┐ ┌────────┐
                 │ RESERVED │ │ FAILED │
                 └────┬─────┘ └────────┘
        payment start│   │ timeout
                      ▼   ▼
             ┌────────────────┐ ┌─────────┐
             │ PAYMENT_PENDING│ │ EXPIRED │
             └───────┬────────┘ └─────────┘
        webhook: ok  │  webhook: decline
                     ▼            ▼
              ┌────────────┐  ┌────────┐
              │ CONFIRMED  │  │ FAILED │
              └────────────┘  └────────┘
```

| From | Allowed to |
|---|---|
| `PROCESSING` | `RESERVED`, `FAILED` |
| `RESERVED` | `PAYMENT_PENDING`, `FAILED`, `EXPIRED` |
| `PAYMENT_PENDING` | `CONFIRMED`, `FAILED`, `EXPIRED` |
| `CONFIRMED` / `FAILED` / `EXPIRED` | *(terminal — no outgoing edges)* |

The rules live in one pure module (`src/constants/booking-status.js`) so they can
be unit-tested without a database, and transitions are applied with **compare-and-set**:

```js
prisma.booking.updateMany({ where: { id, status: FROM }, data: { status: TO } })
```

If two workers race, exactly one update affects a row; the other sees `count: 0`
and raises `InvalidStatusTransitionError`. No distributed lock required.

---

## 12. Roadmap and extension points

| # | Feature | Where it plugs in |
|---|---|---|
| 1 | Atomic Redis inventory reservation (Lua) | `services/inventory.service.js` — `reserveTickets`, `releaseTickets` |
| 2 | Multiple worker processes | already supported (`npm run worker` ×N, `docker compose up --scale worker=3`) |
| 3 | Race-condition prevention | Lua script + CAS transitions (both seams exist) |
| 4 | Idempotency keys | `bookings.idempotencyKey` column + unique index already in schema |
| 5 | BullMQ retries | `defaultJobOptions` in `queues/booking.queue.js` |
| 6 | Failed job recovery | BullMQ failed set + `worker.on('failed')` logging |
| 7 | Reservation expiration | `queues/expiration.queue.js` + `workers/expiration.worker.js` + `RESERVATION_TTL_SECONDS` |
| 8 | Payment gateway | `services/payment.service.js` + `payments` table + `PAYMENT_PENDING` state |
| 9 | Rate limiting | mount `express-rate-limit` in `app.js` (Redis store once Redis is authoritative) |
| 10 | Database transactions | `prisma.$transaction` around multi-row writes |
| 11 | Distributed reliability | outbox/compensation around the Redis↔Postgres dual write |
| 12 | Load testing | `autocannon` against `POST /bookings` |
| 13 | Monitoring | `/health/ready` is already scrape-friendly; add `prom-client` |
| 14 | Docker deployment | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |

---

## 13. Testing

### Backend

```bash
cd backend
npm test              # vitest run
npm run test:watch
```

* `tests/booking-status.test.js` — the lifecycle as an executable spec
  (happy path, illegal skips, absorbing terminal states).
* `tests/health.test.js` — Supertest over the real Express app: liveness,
  route-not-found shape, validation rejection, auth required.

Both suites are dependency-free: they never touch PostgreSQL or Redis, so they
run in CI as-is.

### Frontend

```bash
cd frontend
npm test              # Karma + Jasmine (requires a local Chrome)
```

The base project ships no frontend specs beyond the CLI harness — the UI was
verified manually and end-to-end (see below). Component tests are worth adding
when the booking flow gains real state transitions.

### Load testing (next phase)

```bash
npx autocannon -c 200 -d 30 \
  -m POST http://localhost:4000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -b '{"eventId":"<uuid>","quantity":2}'
```

---

## 14. Verified behaviour

Everything below was executed on this machine against a real PostgreSQL instance
and a real Redis server, not mocked:

| Check | Result |
|---|---|
| `prisma validate` / `prisma generate` | pass |
| `prisma migrate deploy` on an empty database | pass (tables, indexes, FK, CHECK constraints) |
| API boot with Postgres + Redis | `PostgreSQL connection established`, `Redis connection established` |
| `GET /health/ready` | `200`, all three probes `up` |
| Register → duplicate register | `201` then `409 EMAIL_TAKEN` |
| Login with wrong password | `401` (no user enumeration) |
| Non-admin creates event | `403 FORBIDDEN` |
| Admin creates 500-seat event | `201`, `availableTickets: 500` |
| Public event list (no token) | `200` |
| `POST /bookings` | `202`, idempotency key stored |
| Same `Idempotency-Key` twice | `409 IDEMPOTENCY_KEY_REUSED` |
| `quantity: 11` | `400 VALIDATION_ERROR` |
| Read another user's booking | `404` |
| Admin overview / inventory | correct counters (`PROCESSING: 1`, 500 available) |
| Worker consumes the job | `jobId == bookingId`, completed as `SKIPPED` (phase 2 placeholder) |
| `npm test` (backend) | 12/12 passing |
| `npm run build` (frontend) | production bundle, one lazy chunk per page |
| Browser flow | register → events → detail → book → 202 → status page polling → my bookings → admin dashboard → create event |

Not yet verified (needs the phase-specific implementation): inventory reservation,
payment, expiration, load test.

---

## 15. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `CORS policy: No 'Access-Control-Allow-Origin'` | Open the SPA at `http://localhost:4200` (not `127.0.0.1`) or add the origin to `CORS_ORIGIN`. |
| `invalid environment configuration: JWT_SECRET` | Secret shorter than 32 characters — generate one (see §6.2). |
| `P1001: Can't reach database server` | PostgreSQL not running, or wrong `DATABASE_URL`. |
| `password authentication failed for user "postgres"` | Fix the credentials inside `DATABASE_URL`. |
| `/health/ready` returns 503 with `redis: down` | Redis is not running. The API still boots on purpose so the probe can report it. |
| BullMQ warning `minimum Redis version of 6.2.0` | You are on an old Redis build; upgrade (Docker uses `redis:7`). |
| `ng` refuses to start: unsupported Node version | Angular 20+ needs Node ≥ 20.19; this project pins Angular 19 for Node 18. |
| Prisma engine download blocked | Prisma 6 bundles the engines in `node_modules/@prisma/engines`; ensure the proxy allows `binaries.prisma.sh`. |

---

## 16. Learning notes — decisions you should be able to defend

1. **Accept-and-decide split.** The API answers `202` because the *outcome* of a
   booking is a business decision that must be serialised, not an HTTP concern.
2. **Fail fast on configuration.** A process that starts with a weak secret is
   worse than a process that refuses to start.
3. **Error taxonomy.** `AppError` distinguishes expected failures (4xx with stable
   codes) from bugs (5xx, stack logged, generic body). Clients can branch on codes.
4. **Optimistic concurrency over locks.** `UPDATE ... WHERE status = expected`
   is cheaper and deadlock-free compared with `SELECT ... FOR UPDATE` on a hot row.
5. **Dual-write is not a transaction.** The enqueue compensation path exists
   because Redis and PostgreSQL cannot be committed atomically; pretending
   otherwise is how systems lose bookings.
6. **Money as integers.** No floating point anywhere in the money path.
7. **One inventory seam.** Only `inventory.service.js` may decrement stock. Small
   invariants that are enforced in one place are the ones that survive.
