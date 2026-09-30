# Lab 4 AI Use

**Agent:** Codex (GPT-6).

| Prompt | Use of result |
|---|---|
| Run `npm test`; supplied CI log with four PostgreSQL failures. | Reproduced the failures and repaired backward compatibility in migrated-password provisioning. Updated inherited tests to the approved Lab 4 schema/seed contracts and active human auth fixtures; added SYSTEM credential preservation coverage. Verification evidence is recorded in `tests.md`. No commit or push. |
| Address PR #85 review findings: rehearse real Prisma failed-migration recovery, restore historical Lab 2 AI-use, and reconcile Final states and PR validation. | Retained the rollback/backfill test and added guarded CLI failure/status/state-inspection/resolve/redeploy/repeat coverage using disposable migration copies and a representative Lab 3 fixture. Verified full legacy row preservation and duplicate-safe backfill; restored the Lab 2 AI-use file to its pre-Lab-4 baseline. Recorded sanitized evidence and conservative Final states: migration/recovery portions passed, while complete PG-02/PG-13/DATA-02 remain Blocked pending #81 resolution-gate integration evidence. Focused Lab 4 PostgreSQL tests passed (5); full server passed (72 files, 1,065 tests); server/client builds passed. Reconciled PR validation, distinguishing published-head evidence from this local uncommitted follow-up. No commit, push, Issue closure, or peer-review approval. |
| Commit and push. | Authorized publication of the reviewed recovery-test and documentation follow-up on `feature/78-lab4-data-foundation-migration`. Reused the completed test/build evidence, inspected the four-file diff and staging scope, and checked for secret exposure. Publication does not satisfy the remaining #81 resolution-gate evidence or authorize Issue closure. |

Only prompts available in this file/current session are recorded; unavailable prompt history and peer review outcomes were not reconstructed.
