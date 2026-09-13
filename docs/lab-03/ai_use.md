# Lab 3 AI Use Record

This record contains only prompts available in the current session; earlier
prompt history is unavailable.

| Prompt | Use of result |
| --- | --- |
| `$caveman $karpathy-guidelines` | Used the requested compressed communication mode and surgical, evidence-first coding/review guidance while working on the Lab 3 contract. |
| Scrutinize the Lab 3 engineering contract on `feature/59-lab3-engineering-contract`. | Reviewed the four contract documents against the stated scope and acceptance criteria; identified PostgreSQL target, focused-gate, cross-Issue ownership, query, authorization, anchor, and determinism gaps. |
| Rework. | Updated the contract documents to resolve those gaps, including captured PostgreSQL baseline checks, Issue-owned test tags/gates, Public Comment seams, exact query matrices, Admin note-read wording, refresh behavior, and truthful test traceability. |
| Implement Lab 3 Issue 2 data/auth foundation. | Added forward Prisma schema/migration, Argon2id/JWT/session/rate-limit services, authenticated transport, seed/maintenance guards, and focused Issue 2 tests. The original verification record is superseded by the rework row below. |
| Rework. | Fixed Prisma model drift, guarded database CLI commands, made CORS fail closed without `NODE_ENV`, injected JWT verification time, serialized login rate-limit buckets in PostgreSQL transactions, and bounded session/rate-limit cleanup. Focused unit/API and server build checks pass; the dedicated Lab 3 PostgreSQL target was unavailable, so PG evidence remains unverified. |
| Rework with Docker and CI verification; add tests to CI if needed. | Added a separate tmpfs-backed Lab 3 PostgreSQL Compose target, captured baseline identities without recording values, strengthened populated-migration and maintenance PostgreSQL coverage, ran guarded migration deploy, seed twice, maintenance twice, and the five-suite PostgreSQL gate. Fixed the PostgreSQL advisory-lock scalar-result issue found by that gate, then added a focused Issue 2 GitHub Actions workflow covering unit/API, migration, seed, maintenance, PostgreSQL, and build checks. |
