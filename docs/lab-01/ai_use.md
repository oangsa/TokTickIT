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

## Reflection
Prompts got better when they carried the Issue's acceptance criteria verbatim
instead of a summary — the agent then stopped at the health check rather than
drifting into the categories work, and the leftover `TODO(Issue N)` markers gave
it an explicit boundary. The corrections were both about scope and evidence: in
Issue 1 it invented a `GET /health` route nobody asked for, and in Issue 2 it
wrote a manual browser test into `tests.md` that had never been run. Anything
the agent claims as verified is worth re-running before it goes into the docs.
