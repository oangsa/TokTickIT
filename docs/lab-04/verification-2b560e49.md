# PR #85 local execution evidence — 2b560e49

## Revision and scope

Verified on 2026-10-01 against HEAD `2b560e49817a32048c0ca760b9b5bca8aa849e7e`, branch `feature/78-lab4-data-foundation-migration`.
The working tree was clean when verification started. Server/client source, tests, dependencies, migrations, and workflows remain identical to that revision; only Lab 4 documentation changed during this task. No commit or push was made during evidence collection; the subsequent user prompt authorized publication of this documentation-only follow-up.

B-01: PG-02, PG-13, and DATA-02 in `tests.md` now exactly match the frozen `dae51160` expectations, with Final changed to **Blocked**. Existing migration/recovery checks pass as partial evidence; they do not prove migrated-only REST resolution rejection. That integration evidence remains pending #81. No acceptance contract amendment or Issue closure is claimed.

B-02: fresh local execution logs were collected for this SHA. These are author-side execution evidence, not GitHub CI statuses or independently witnessed results. No GitHub status, raw-log artifact, PR body, or Issue was published during evidence collection. Subsequent publication of this report does not publish the raw logs or establish a CI result; independent execution evidence remains pending.

## Database safety

The existing disposable container `toktickit-lab3-test-postgres` was verified running with database `toktickit_lab3_test` and host port `55433`. Credentials were loaded privately from its configuration. Actual normal database baselines were captured privately before overriding all three of `TEST_DATABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` to this local target, with `NODE_ENV=test`. The existing target guard checked the explicit overrides and distinct baseline identities. Connection URLs and the container password were redacted from saved server logs.

Before any test writes, read-only Prisma status reported:

```text
Datasource "db": PostgreSQL database "toktickit_lab3_test", schema "public" at "127.0.0.1:55433"
7 migrations found in prisma/migrations
Database schema is up to date!
```

The same status passed after the full regression suite. Tests exercised their established disposable fixture resets and recovery schemas; no shared database deployment or production-data reset was performed.

## Commands and observed results

All server commands ran from `server/` with the guarded environment above. The client command ran from `client/`. Every listed command exited 0.

| Command | Observed result | Saved log |
|---|---|---|
| `npx --no-install prisma migrate status` before tests | Seven migrations; local schema up to date. | `migration-status-before.log` |
| `npm test -- tests/lab-04/postgres` | 3 files / 5 tests passed, including transactional rollback, real failed-Prisma-migration recovery/redeploy, typed Activity/Claim constraints, and seed/provisioning idempotency. | `lab4-postgres.log` |
| `npm test` | 72 files / 1,065 tests passed, including inherited Labs 1–3 PostgreSQL coverage. | `full-server.log` |
| Server `npm run build` | TypeScript compilation passed. | `server-build.log` |
| Client `npm run build` | TypeScript/Vite build passed. | `client-build.log` |
| `npx --no-install prisma migrate status` after tests | Seven migrations; local schema up to date. | `migration-status-after.log` |
| `git diff --check` | Passed after documentation corrections. | `documentation-check.log` |
| Frozen-row comparison against `git show dae51160:docs/lab-04/tests.md` | All three complete rows match exactly except Final=Blocked; production/test/workflow paths unchanged from HEAD. | `documentation-check.log` |

Focused PostgreSQL run: 06:04:12–06:04:29 UTC. Full server run: 06:04:43–06:05:49 UTC. Final migration status: 06:06:10 UTC. The server logs record the full SHA, command, UTC start/end timestamps, target identity, and exit code.

Exact full-suite summary:

```text
Test Files  72 passed (72)
     Tests  1065 passed (1065)
```

Existing PostgreSQL concurrent-query deprecation warnings and Vite dependency-annotation/chunk-size warnings appeared. Neither application package defines a lint script. Client tests and browser E2E were not run; this task changes documentation only. No test was added, removed, or weakened, and no production behavior changed, so a Red/Green cycle is not applicable.

Sanitized logs and SHA-256 checksums are available locally in `/tmp/toktickit-pr85-2b560e49/`; the portable bundle is `/tmp/toktickit-pr85-2b560e49-evidence.tar.gz`. Temporary artifacts are not committed or uploaded. Publish the bundle or obtain a CI run tied to the applicable reviewed SHA before claiming independently accessible B-02 evidence.

## Independently inspectable CI discovered during the PR #85 follow-up

[GitHub Actions run 36823311846](https://github.com/oangsa/TokTickIT/actions/runs/36823311846) completed successfully at exact documentation-only head `eb65745edb8c9cbccc5effccd25adca544f4573e`. Its [server job](https://github.com/oangsa/TokTickIT/actions/runs/36823311846/job/110243390300) independently records all three Lab 4 PostgreSQL files (five tests) within the full server suite (72 files / 1,065 tests), server build, guarded seven-migration preflight and successful deployment to disposable `127.0.0.1:5432/toktickit_lab3_test`. Its [client job](https://github.com/oangsa/TokTickIT/actions/runs/36823311846/job/110243389985) records passing client tests and client build. This previously existing CI was inspected in this session; no new application rerun was performed.

That run does not record `git diff --check` or a final post-suite `prisma migrate status`. Two minimal steps are prepared in the existing verification workflow to close those evidence gaps at the next published revision; the user authorized commit/push of this follow-up; their CI execution remains pending publication. Earlier statements that no CI exists describe evidence known at collection time and are superseded by these verified links. The original local archive remains unpublished at the user's explicit request. No peer-review approval or complete Blocked-row acceptance is implied by the CI suite.
