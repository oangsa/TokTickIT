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
| 7 | Vitest | Error state shows Offline, and no category list | Pass (Issue 4) |
| 8 | Vitest | `checkSystem()` rejects instead of hanging when the backend never responds | Pass (2026-08-13 fix) |

Test 8 was added with the hung-backend fix on 2026-08-13; see the section at the
end of this file for how the failure was reproduced. Test 2 hits the real
database, so `server/.env` must carry a reachable
`DATABASE_URL` (and `DIRECT_URL` for migrations) and the migration and seed must
be applied first (`npm run prisma:migrate && npm run prisma:seed`). The other
seven tests need no database.

## Automated test output

Last run 2026-08-09 on `lab1-staging` at `dde47bf` — that is *after* the Prisma 7
/ driver-adapter upgrade (`38c6c93`), which landed after the Issue 3 and Issue 4
evidence below was first recorded. All Lab 1 work lives on `lab1-staging`;
`main` is back at the `60b620e` scaffold and none of this reproduces there.

`cd server && npm test`

```text
 ✓ tests/lab-01/health.test.ts (1 test) 14ms
 ✓ tests/lab-01/categories.test.ts (1 test) 324ms
   ✓ GET /api/categories > returns the four seeded categories in id order 323ms

 Test Files  2 passed (2)
      Tests  2 passed (2)
```

`cd client && npm test`

```text
 ✓ tests/lab-01/App.test.tsx (5 tests) 135ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Type checks: `npx tsc --noEmit` in `server/` and in `client/`, both exit 0.

## Re-verification after the Prisma 7 upgrade (2026-08-09)

`38c6c93` replaced the datasource `url`/`directUrl` with `server/prisma.config.ts`
and gave `PrismaClient` an explicit `@prisma/adapter-pg` adapter, so every check
that touches the database was run again rather than carried over. All of the
following was executed on `dde47bf`.

Live server (`cd server && npm run dev`, http://localhost:3000):

```text
$ curl -i http://localhost:3000/api/health
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

{"status":"ok","service":"TokTickIT API"}

$ curl -i http://localhost:3000/api/categories
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8

[{"id":1,"name":"Account and Access"},{"id":2,"name":"Hardware"},
 {"id":3,"name":"Software"},{"id":4,"name":"Network"}]
```

500 branch, same build started with `DATABASE_URL=postgresql://x:x@127.0.0.1:1/x
PORT=3001`:

```text
$ curl -i http://localhost:3001/api/categories
HTTP/1.1 500 Internal Server Error
Content-Type: application/json; charset=utf-8

{"error":"Could not load categories."}
```

The adapter's connection error stays in the server log (it ends
`clientVersion: '7.9.1'`); the response body carries no connection string and no
stack trace.

Migration tooling under the new config — this is what @kittipichcha could not run
on PR #9, so it is checked explicitly rather than assumed:

```text
$ npx prisma migrate status
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public"
1 migration found in prisma/migrations

Database schema is up to date!
```

The config resolves its connection and the one migration is applied. This proves
the tooling loads and connects; it does not prove a first-time `prisma migrate
dev` against an empty database, which has not been re-run since the upgrade.

Seed idempotence under Prisma 7 — `npm run prisma:seed` twice, then the table
read back with `prisma.category.findMany({ orderBy: { id: "asc" } })`:

```text
=== seed run 1 ===   Seeded 4 categories.
=== seed run 2 ===   Seeded 4 categories.

count: 4
[
  { id: 1, name: 'Account and Access', createdAt: 2026-08-08T06:45:52.237Z },
  ...
  { id: 4, name: 'Network',            createdAt: 2026-08-08T06:45:53.082Z }
]
```

Still four rows, and the `createdAt` values are the ones written on 2026-08-08 —
the upgrade did not re-insert or rewrite them.

Dependency audit (raised by the reviewer on PR #6): `npm audit` reports
5 vulnerabilities (3 moderate, 1 high, 1 critical) in **both** packages, and
every one of them is the same dev-only chain — `vitest` -> `@vitest/mocker` /
`vite-node` -> `vite` -> `esbuild`. The critical one (GHSA-5xrq-8626-4rwp) needs
the Vitest UI server listening, which this repo never starts. No runtime
dependency (`express`, `cors`, `@prisma/client`, `@prisma/adapter-pg`, `react`)
is affected, so nothing shipped by the app is exposed. Not fixed on this branch:
`npm audit fix --force` wants a Vitest major bump, which is out of Lab 1 scope.

## What is not verified

Nothing here blocks Issues 2–4 — no test fails and none is skipped — but these
are the gaps a reader should not assume are covered:

1. **Browser click-through of the Issue 4 failure states.** Only the success
   state was clicked in a real browser (2026-08-08, below). The Offline browser
   check in the Issue 2 section predates the categories fetch, so the "health
   passes but `/api/categories` returns 500" path has Vitest coverage only, never
   a manual one. The 500 response itself was confirmed with curl above.
2. **The empty and loading states in a real browser.** Vitest only.
3. **`prisma migrate dev` from an empty database under Prisma 7.** Only
   `migrate status` was re-run after the upgrade; the migration itself was
   applied on 2026-08-08 under Prisma 6.
4. **The 8 s request timeout under Vitest.** Clicked through in a browser
   (see the last section), but the automated coverage stubs `fetch` — `jsdom`
   cannot run the real one, also explained there.

## Production build — two defects outside the Issue 2–4 criteria

Both builds compile. `cd server && npm run build` (tsc) and
`cd client && npm run build` (tsc + vite) both exit 0, and the client emits
`dist/assets/index-*.js` (145 kB) and `index-*.css` (231 kB). Running the
compiled server serves both routes:

```text
$ node dist/src/index.js
TokTickIT API listening on http://localhost:3000
$ curl -s localhost:3000/api/health
{"status":"ok","service":"TokTickIT API"}
$ curl -s localhost:3000/api/categories
[{"id":1,"name":"Account and Access"}, … ]
```

Note the path. Two defects found while checking this, neither of them covered by
any Issue's acceptance criteria. Both are fixed on `fix/build-output-paths`:

1. **`npm start` was broken.** The
   script was `node dist/index.js`, but `server/tsconfig.json` includes
   `prisma` and `tests` alongside `src`, so tsc roots the output at the package
   and emits `dist/src/index.js`. `npm start` failed with `MODULE_NOT_FOUND`.
   The fix is the one-line script change; `"rootDir": "src"` with a src-only
   `include` was rejected because it would drop `prisma` and `tests` from the
   `tsc` type check that `npm run build` currently performs. Verified after a
   clean `rm -rf dist && npm run build`:

   ```text
   $ npm start
   > node dist/src/index.js
   TokTickIT API listening on http://localhost:3000
   ```

2. **`client && npm run build` wrote JavaScript next to the sources.** The
   script runs a bare `tsc` with neither `noEmit` nor `outDir` in
   `client/tsconfig.json`, so it dropped `src/App.js`, `src/api.js`,
   `src/main.js`, `tests/setup.js` and `tests/lab-01/App.test.js` into the tree.
   Vite's real output goes to `client/dist`, so those files were pure litter,
   and `.gitignore` does not cover them. The fix is `"noEmit": true` in the
   client tsconfig — which is also how `npm test` and the type check already run
   it — so `tsc` in the build script is now a type check and Vite stays the only
   thing that emits. The five stray files were deleted. Verified:

   ```text
   $ npm run build
   ✓ 28 modules transformed.
   dist/index.html                   0.39 kB
   dist/assets/index-BL5QWnkG.css  231.14 kB
   dist/assets/index-BQo7zBaG.js   145.49 kB
   $ find src tests -name '*.js'
   $ npm test
   Test Files  1 passed (1)
        Tests  5 passed (5)
   ```

## Manual check — Issue 4 category list  (2026-08-08, before the Prisma 7 upgrade)

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

## Manual check — Issue 3 category model and seed  (2026-08-08, before the Prisma 7 upgrade)

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

## Manual check — Issue 2 health check  (2026-08-08, before the Prisma 7 upgrade)

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
   http://localhost:3000.` (The `— <reason>` suffix was removed on 2026-08-13,
   see the last section; the alert now reads `Backend status: Offline`.)

The path under test is React `handleCheck` -> `checkSystem()` in
`client/src/api.ts` -> `GET /api/health` in `server/src/app.ts`.

## Hung backend leaves the UI on `Loading…`  (2026-08-13, `58c70b5`)

The Offline alert above only covers a backend that **refuses** the connection.
A backend that is down without refusing — dropped packets, a tunnel or proxy
holding the socket open, a server that accepted and then hung — never rejects
`fetch`, so `handleCheck`'s `"loading"` state never advanced and the button
stayed disabled. Reproduced with a TCP listener that accepts and writes nothing
(`net.createServer(() => {})` on port 3000), against the pre-fix code:

| Run | Backend | Result |
|---|---|---|
| E1 | nothing listening on `:3000` | rejects in 15 ms -> Offline alert |
| E2 | accepts, never responds | `checkSystem()` still pending at 3000 ms |
| E3 | accepts, never responds, full `App` | button `Loading…`, `disabled=true`, still at 3000 ms |
| E4 | `checkSystem` mocked to reject | Offline alert |

E1 and E4 rule out a broken error path — only the missing request timeout
explains all four. Fix: `AbortSignal.timeout(8000)` on both fetches in
`checkSystem()`; the existing `.catch()` already maps the abort to the Offline
state, so `App.tsx` needed no new branch. The unused `errorMessage` state and
the `— <reason>` suffix on the alert were dropped in the same commit.

Regression test (`client/tests/lab-01/api.test.tsx`, test 8): `fetch` is stubbed
with a promise that only ever settles on `signal`'s `abort` event, so removing
the signal makes the test hang until Vitest's timeout. Verified in both
directions — passes at 53 ms as committed, fails when the `signal` option is
deleted from `api.ts`.

`cd client && npm test`

```text
 ✓ tests/lab-01/api.test.tsx (1 test) 53ms
 ✓ tests/lab-01/App.test.tsx (5 tests) 131ms

 Test Files  2 passed (2)
      Tests  6 passed (6)
```

Type checks: `npx tsc --noEmit` in `server/` and in `client/`, both exit 0.

Browser check (2026-08-13): with `nc -l 3000` standing in for the hung backend —
it accepts the connection and never answers — `npm run dev` and **Check System**
at http://localhost:5173 ends on the red `Backend status: Offline` alert instead
of staying on `Loading…`. This is the same trigger as E2/E3 above, which held the
pre-fix build on `Loading…` indefinitely.

Not verified: the fix cannot be exercised end-to-end under Vitest. In the `jsdom` environment
`AbortSignal` comes from jsdom while `fetch` comes from Node's undici, so a real
`fetch(url, { signal })` call is rejected by argument validation before any
request goes out:

```text
TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
```

That is a test-environment realm mismatch, not a defect in the shipped code — a
browser takes both from the same realm, as the click-through above confirms —
but it is why test 8 stubs `fetch` instead of talking to a real socket.
