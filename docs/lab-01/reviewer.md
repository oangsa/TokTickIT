# Lab 1 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| #6 | feature/1-project-foundation | Approved |
| #7 | feature/2-health-check | Approved |
| #8 | feature/3-category-seed | Approved |
| #9 | feature/4-category-list | Changes requested, then Approved |

Reviewer comments I received (@kittipichcha):

- **#6** — "After I've checked the branch, it can work correctly but I will add a
  few note here. 1. There are vulnerability dependencies warning that you should
  take a look however it can run correctly. 2. It would be nice if you add how
  you have tested that the app can work perfectly in doc/tests.md, it would be
  nice."
- **#7** — "LGTM. Everything can run correctly."
- **#8** — "It can run correctly and no conflict & critical vulnerability, good job."
- **#9** — Changes requested, on `server/prisma/schema.prisma` line 10: "`url`
  should have not been deleted in here, I could not run `npm run prisma:migrate`.
  If this is intentional, you need to tell me how to migrate and test the prisma
  connection." Plus a separate comment: the Lab 1 sheet asks for
  feature branches to be merged into `lab1-staging` before `main`, which may cost
  marks.
- **#9 (re-review after the fix)** — "It can correctly now and as I've seen
  there's no bug or error, nice works." Approved.

How I responded:

- **#6, test evidence** — `docs/lab-01/tests.md` now records the commands
  actually run for each Issue: the Supertest and Vitest output, the curl
  requests, the seed-idempotence check, and the `tsc --noEmit` checks, plus what
  was left unverified.
- **#6, dependency warnings** — audited rather than dismissed. `npm audit` in
  both packages reports 5 vulnerabilities (3 moderate, 1 high, 1 critical), all
  in the same dev-only chain `vitest -> vite -> esbuild`; no runtime dependency
  is affected and the critical advisory needs the Vitest UI server, which this
  repo never starts. Left unfixed on purpose — the fix is a Vitest major bump,
  out of Lab 1 scope. Detail in `docs/lab-01/tests.md`.
- **#9, missing `url` in the datasource** — intentional, and the reviewer was
  right that it was undocumented. Prisma 7 no longer accepts `url`/`directUrl` in
  `schema.prisma`; the migration connection moved to `server/prisma.config.ts`
  and the app connects through the `@prisma/adapter-pg` adapter in
  `server/src/prisma.ts`. The README now explains this and the `.env` keys
  (`DATABASE_URL` pooled, `DIRECT_URL` for migrations), so
  `npm run prisma:migrate` works from a clean clone. Re-reviewed and approved.
- **#9, `lab1-staging`** — accurate: `lab1-staging` exists on the remote but PRs
  #6–#9 all targeted `main` directly, and `origin/lab1-staging` is now 11 commits
  behind `main`. Nothing to undo retroactively. <fill in what you decided: fast-
  forward `lab1-staging` to `main` and route later PRs through it, or leave it.>

## Pull Requests I reviewed for my partner

### feature/1-project-foundation
My comment:
LGTM!

Partner's response:


### feature/2-health-check
My comment:
I don't see a blocking issue against the five criteria you supplied. LGTM!

Partner's response:

### feature/3-category-seed
My comment:
All five acceptance criteria are satisfied by the implementation.

Partner's response:


### feature/4-category-list
My comment:
Request changes: the category ordering does not fully satisfy the acceptance criteria.

The Prisma query currently orders only by `id ASC`, but the requirement explicitly says the API response must be in a predictable ascending order for both ID and name.

Please update the query to order by both fields, for example:

```ts
orderBy: [
  { id: "asc" },
  { name: "asc" },
]
```

Also update the Supertest coverage so it verifies the required ordering, not only the ID order.

All acceptance criteria must be completed before this PR can be approved.

Partner's response:


My comment:
Request changes: the Prisma ordering fix is now correct, but the test coverage still does not fully address the previous review.

The API now orders by both `id ASC` and `name ASC`, but the Supertest tests only verify ID ordering. Please update the backend test coverage to also verify the required name ordering.

Since all acceptance criteria and prior review comments must be completed before approval, this remains blocking.


Partner's response:
