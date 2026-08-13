# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Claude Code (Claude Opus 5)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Initialise the Lab 1 foundation (Issue 1): Vite + React + TypeScript client with Bootstrap, Express + TypeScript server, Prisma for PostgreSQL, Vitest + Supertest, `.gitignore`, `.env.example`, README. | Kept the scaffold. Rejected a `GET /health` route and its test the agent added on its own — Issue 1 asks for no routes. |
| 2 | Review that scaffold against the provided lab starter and list every divergence. | Accepted. It found the scaffold had been generated independently rather than filled in from the starter: no CORS, no `client/src/api.ts`, no client test setup, no seed, a different Prisma major, and a test asserting `GET /` returns 404 that passes on an empty app. |
| 3 | Rework the repository onto the starter scaffold, without implementing any of the TODOs. | Applied. Replaced the tree with the starter; kept `AGENTS.md`, the README, and this file. Issues 2–4 left unimplemented on purpose. |
| 4 | Implement Issue 2 from its acceptance criteria: `GET /api/health` returning 200 with `{ status: "ok", service: "TokTickIT API" }`, a Supertest test, and a React page showing the backend status from a real API call plus a useful error when the backend is down. | Accepted. Route, `checkSystem()` health fetch, and Online/Offline alerts in `App.tsx`. Kept the categories fetch and the category list as `TODO(Issue 4)` so the branch stays scoped to Issue 2. |
| 5 | Fill the Lab 1 docs with the changes from Issue 2. | Partly rewritten. The first draft of `tests.md` wrote up a browser click-through as if it had been run; only the curl request, the Vitest runs, and the `tsc --noEmit` checks were real. Kept the evidence that actually executed and left the UI check unmarked until I ran it in the browser myself. |
| 6 | Implement Issue 3 from its acceptance criteria: `Category` model (`id`, unique `name`, `createdAt`), a migration creating the table, a seed inserting the four categories that is safe to run twice, and no committed credentials. Ignore the unfinished Issue 4 work. | Accepted. Model, migration `add_category`, and an `upsert`-per-name seed. It also spotted that my `.env` points at Supabase's pgbouncer pooler, which `prisma migrate` cannot use, and added `directUrl = env("DIRECT_URL")` — the migration would have failed without it. Verified its idempotence claim myself by running the seed twice and counting rows. |
| 7 | Update the Lab 1 docs for Issue 3. | Accepted. README status row plus an Issue 3 section, and the migration/seed evidence in `tests.md` — this time it only wrote up commands it had actually run. |
| 8 | Implement Issue 4 from its acceptance criteria: `GET /api/categories` reading from PostgreSQL through Prisma, `{ id, name }` in a predictable order, a Supertest test, React rendering the API's categories instead of hard-coded ones, loading and error states, and a Vitest test for the list UI. | Accepted. `findMany` with `select` + `orderBy: { id: "asc" }`, a 500 branch that logs the Prisma error and returns a fixed message, the categories fetch in `checkSystem()`, and a Bootstrap list group in the success state. It started by checking the database and found my branch was still cut from before the Issue 3 merge, so it fast-forwarded onto `main` first — I had assumed the branch was current. It also added a loading-state test I had not stubbed. |
| 9 | Update the Lab 1 docs for Issue 4. | Accepted. It ran the 500 branch for real against an unreachable `DATABASE_URL` rather than describing it, and wrote down that the Issue 4 UI was never click-tested in the browser instead of implying it had been. |
| 10 | Review the Issue 4 branch against its acceptance criteria and the repo docs, then fix what it found. | Partly accepted. It re-ran both suites and both type checks rather than trusting `tests.md`, and re-triggered the 500 branch against `127.0.0.1:1` itself — all six criteria held. Took its guard on the unchecked `response.json()` parse (a malformed body was rendering a raw `SyntaxError` into the Offline alert) and the missing empty state that AGENTS.md §5 asks for. Rejected its suggestion to run the two fetches with `Promise.all`: it flips which error message wins for no visible gain. It also filled `reviewer.md`, which I had left as a template. |
| 11 | Update the Lab 1 docs, especially `tests.md`. | Accepted. It noticed my branch was 11 commits behind `main` and rebased before writing anything, then re-ran everything the Prisma 7 upgrade could have invalidated — both suites, both type checks, the two curl requests, the 500 branch against `127.0.0.1:1`, and the seed twice — instead of copying the pre-upgrade numbers forward. It also answered the dependency-warning review comment with an actual `npm audit` breakdown instead of a claim, and pulled @kittipichcha's #9 review off GitHub rather than paraphrasing it from memory. |
| 12 | Trace the `bun run start` `MODULE_NOT_FOUND` failure, then fix it on a new branch cut from `lab1-staging`. | Accepted. It reproduced the failure from a clean `rm -rf dist && tsc` first, which ruled out a stale build before any fix was proposed, and traced it to the `include` list rooting tsc's output at the package. Took the one-line script change over `"rootDir": "src"` — the second option would have dropped `prisma` and `tests` from the build's type check. It also caught that my local `lab1-staging` was two commits behind origin and pulled before branching. Then I widened the branch to cover the second build defect from `tests.md` as well — `"noEmit": true` in the client tsconfig, which it reproduced by running `tsc` and listing the five stray `.js` files before changing anything. |
| 13 | Trace the infinite loading state when the backend is down on the client side. | Accepted. It refused to name a cause until it had a repro, and the repro is what corrected me: I reported "backend down" but with nothing listening the app already shows Offline in 15 ms. The hang only appears when the connection is *accepted* and never answered, which it reproduced with a TCP listener that writes nothing. Fix was `AbortSignal.timeout` on both fetches rather than anything in `App.tsx`. Then I asked it to drop the `— <reason>` suffix from the Offline alert; it also deleted the `errorMessage` state that went unused and the assertion in `App.test.tsx` that had pinned the old text — worth knowing it changed a provided lab test, not only my code. |

## Reflection
Prompts got better when they carried the Issue's acceptance criteria verbatim
instead of a summary — the agent then stopped at the health check rather than
drifting into the categories work, and the leftover `TODO(Issue N)` markers gave
it an explicit boundary. The corrections were both about scope and evidence: in
Issue 1 it invented a `GET /health` route nobody asked for, and in Issue 2 it
wrote a manual browser test into `tests.md` that had never been run. Anything
the agent claims as verified is worth re-running before it goes into the docs.
Issue 3 was the counter-example that made the habit worth keeping in both
directions: re-running the seed confirmed the idempotence claim, and the agent
had caught a pooled-connection problem in my own `.env` that I would not have
found until `prisma migrate` failed. Issue 4 repeated that pattern from the
other side — it read the database and my branch state before writing anything,
and caught that the branch predated the Issue 3 merge, which would have left the
new route calling a `Category` model that was not in the schema. That happened
twice, so it is the real lesson: my local branch was stale again during the final
docs pass, and evidence written from a stale checkout looks exactly like evidence
written from a current one. The Prisma 7 upgrade landed after the Issue 3 and 4
write-ups, so every database claim in `tests.md` had to be re-run before it could
still be called evidence. The last prompt turned that habit on my own bug report:
"the backend is down" was the wrong description of the failure, and only building
the repro first showed that the refused-connection path had worked all along.
Reporting the symptom is not the same as knowing the trigger.
