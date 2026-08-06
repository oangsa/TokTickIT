# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Claude Code (Claude Opus 5)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Initialise the Lab 1 foundation (Issue 1): Vite + React + TypeScript client with Bootstrap, Express + TypeScript server, Prisma for PostgreSQL, Vitest + Supertest, `.gitignore`, `.env.example`, README. | Kept the scaffold. Rejected a `GET /health` route and its test the agent added on its own — Issue 1 asks for no routes. |
| 2 | Review that scaffold against the provided lab starter and list every divergence. | Accepted. It found the scaffold had been generated independently rather than filled in from the starter: no CORS, no `client/src/api.ts`, no client test setup, no seed, a different Prisma major, and a test asserting `GET /` returns 404 that passes on an empty app. |
| 3 | Rework the repository onto the starter scaffold, without implementing any of the TODOs. | Applied. Replaced the tree with the starter; kept `AGENTS.md`, the README, and this file. Issues 2–4 left unimplemented on purpose. |
| 4 |  |  |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.
