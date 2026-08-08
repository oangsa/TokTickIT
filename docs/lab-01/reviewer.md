# Lab 1 — Peer Review Record  (fill this in)

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

## Pull Requests I authored (reviewed by my partner)
| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| #6 | feature/1-project-foundation | Approved |
| #7 | feature/2-health-check | Approved |
| #8 | feature/3-category-seed | Approved |
| _not opened yet_ | feature/4-category-list | _pending_ |

Reviewer comments I received (@kittipichcha):

- **#6** — "After I've checked the branch, it can work correctly but I will add a
  few note here. 1. There are vulnerability dependencies warning that you should
  take a look however it can run correctly. 2. It would be nice if you add how
  you have tested that the app can work perfectly in doc/tests.md, it would be
  nice."
- **#7** — "LGTM. Everything can run correctly."
- **#8** — "It can run correctly and no conflict & critical vulnerability, good job."

How I responded: the review on #6 asked for written test evidence, so
`docs/lab-01/tests.md` now records the commands actually run for each Issue —
the Supertest and Vitest output, the curl requests, and the `tsc --noEmit`
checks — plus what was left unverified. Dependency warnings: <fill in what you
decided here>.

## Pull Requests I reviewed for my partner

### feature/1-project-foundation
My comment:
LGTM!

Partner's response:
> After I've checked the branch, it can work correctly but I will add a few notes here.
> - There are vulnerable dependency warnings that you should take a look at — however it can run correctly.
> - It would be nice if you add how you have tested that the app works in `docs/lab-01/tests.md`.
