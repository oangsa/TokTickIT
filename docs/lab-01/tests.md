# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Pass (Issue 2) |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Pass (Issue 4) |
| 3 | Vitest | Heading renders | Pass |
| 4 | Vitest | Success state shows Online + category list | Pass (Issue 4) |
| 5 | Vitest | Loading state disables the button while the request is in flight | Pass (Issue 4) |
| 6 | Vitest | Empty state shows "No categories yet." when the API returns none | Pass (Issue 4) |
| 7 | Vitest | Error state shows Offline + message, and no category list | Pass (Issue 4) |

Test 2 hits the real database, so it needs the migration and the seed applied
first (`npm run prisma:migrate && npm run prisma:seed`).

## Automated test output

`cd server && npm test`

```text
 ✓ tests/lab-01/health.test.ts (1 test) 16ms
 ✓ tests/lab-01/categories.test.ts (1 test) 404ms
   ✓ GET /api/categories > returns the four seeded categories in id order 403ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
```

`cd client && npm test`

```text
 ✓ tests/lab-01/App.test.tsx (5 tests) 161ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Type checks: `npx tsc --noEmit` in `server/` and in `client/`, both exit 0.

## Manual check — Issue 4 category list

Run against the live server (`cd server && npm run dev`, http://localhost:3000):

```text
$ curl -i http://localhost:3000/api/categories
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

[{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},
 {"id":3,"name":"Software"},{"id":4,"name":"Network"}]
```

Only `id` and `name` are returned — `createdAt` is dropped by the `select` — and
`orderBy: { id: "asc" }` fixes the order, so the response is the same on every
call regardless of the order PostgreSQL happens to return rows in.

The 500 branch was exercised by starting the same server against an unreachable
database (`DATABASE_URL` pointed at `127.0.0.1:1`):

```text
$ curl -i http://localhost:3000/api/categories
HTTP/1.1 500 Internal Server Error
Content-Type: application/json; charset=utf-8

{"error":"Could not load categories."}
```

The Prisma error goes to the server log only; the client sees a fixed message
with no connection string or stack trace in it.

The path under test is React `handleCheck` -> `checkSystem()` in
`client/src/api.ts` -> `GET /api/health` then `GET /api/categories` in
`server/src/app.ts` -> `prisma.category.findMany` -> PostgreSQL.

Browser click-through (2026-08-08, author, `npm run dev` on both sides,
http://localhost:5173): pressed **Check System** against the running API — the
Online alert and the four seeded categories rendered as expected. The same UI
states are also covered by the four Vitest cases above (list rendered from the
mocked API, disabled **Loading…** button, "No categories yet." on an empty list,
Offline alert with no list).

## Manual check — Issue 3 category model and seed

The seed has no automated test (Issue 4's Supertest case covers reading the
categories back through the API). It was verified directly against the database.

Migration applied by `npx prisma migrate dev --name add_category`:

```text
Applying migration `20260808064543_add_category`
Your database is now in sync with your schema.
```

`server/prisma/migrations/20260808064543_add_category/migration.sql`:

```sql
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
```

Idempotence — `npm run prisma:seed` run **twice** in a row, then the table read
back with `prisma.category.findMany({ orderBy: { id: "asc" } })`:

```text
=== seed run 1 ===   Seeded 4 categories.
=== seed run 2 ===   Seeded 4 categories.

count: 4
[
  { id: 1, name: 'Account and Access', createdAt: 2026-08-08T06:45:52.237Z },
  { id: 2, name: 'Hardware',           createdAt: 2026-08-08T06:45:52.521Z },
  { id: 3, name: 'Software',           createdAt: 2026-08-08T06:45:52.807Z },
  { id: 4, name: 'Network',            createdAt: 2026-08-08T06:45:53.082Z }
]
```

Four rows after two runs, with the original `createdAt` values intact — the
`upsert` on the unique `name` matched the existing rows instead of inserting.

Credentials check: `git ls-files | grep -i env` lists only `client/.env.example`
and `server/.env.example`; `git check-ignore -v server/.env` reports it ignored
by `.gitignore:5 (*.env)`.

## Manual check — Issue 2 health check

Run against the live server (`cd server && npm run dev`, http://localhost:3000):

```text
$ curl -i http://localhost:3000/api/health
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

{"status":"ok","service":"TokTickIT API"}
```

Killing the server and repeating the request gives curl exit code 7
(connection refused) — the same failure the browser sees, which
`checkSystem()` turns into `Cannot reach the TokTickIT API at <VITE_API_URL>.`

Browser check of the two UI states — both confirmed:

1. `cd client && npm run dev`, open http://localhost:5173 with the server up,
   click **Check System** -> green alert `Backend status: Online`.
2. Stop the server, click **Check System** again -> red alert
   `Backend status: Offline — Cannot reach the TokTickIT API at
   http://localhost:3000.`

The path under test is React `handleCheck` -> `checkSystem()` in
`client/src/api.ts` -> `GET /api/health` in `server/src/app.ts`.
