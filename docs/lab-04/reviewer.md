# Lab 4 — Peer Review Record

**Author:** 67070503477 — GitHub: @oangsa
**Peer reviewer:** 67070503405 — GitHub: @kittipichcha

GitHub reviews and conversation comments retrieved on 2026-10-08. Every body below is copied verbatim, including spelling, Markdown, raw HTML, whitespace and line breaks. Fences separate source text from record metadata. Empty review bodies are identified explicitly. Dates are UTC.

The requested 13 PRs contain 26 review submissions and four conversation comments; none contains an inline review comment. No posted author reply by @oangsa exists on PRs #84–#90. Changes to PR descriptions are not presented as conversation replies.

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Review history | PR status |
|---|---|---|---|
| [#84](https://github.com/oangsa/TokTickIT/pull/84) | `feature/77-lab4-engineering-contract` | Changes Requested; Approved | Merged into `lab4-staging` |
| [#85](https://github.com/oangsa/TokTickIT/pull/85) | `feature/78-lab4-data-foundation-migration` | Changes Requested; Changes Requested; Approved | Merged into `lab4-staging` |
| [#86](https://github.com/oangsa/TokTickIT/pull/86) | `feature/79-actions-taken-backend-api` | Approved; Changes Requested; Approved | Merged into `lab4-staging` |
| [#87](https://github.com/oangsa/TokTickIT/pull/87) | `feature/80-actions-taken-ui-global-lookup` | Approved | Merged into `lab4-staging` |
| [#88](https://github.com/oangsa/TokTickIT/pull/88) | `feature/81-ticket-workflow-resolution` | Approved | Merged into `lab4-staging` |
| [#89](https://github.com/oangsa/TokTickIT/pull/89) | `feature/82-role-dashboards` | Approved | Merged into `lab4-staging` |
| [#90](https://github.com/oangsa/TokTickIT/pull/90) | `feature/83-lab4-final-verification-release` | Commented; Approved | Merged into `lab4-staging` |

### PR #84 — docs: define Lab 4 engineering contract

[Pull request](https://github.com/oangsa/TokTickIT/pull/84)

#### Review by @kittipichcha — CHANGES_REQUESTED

Source: [Review 5361269858](https://github.com/oangsa/TokTickIT/pull/84#pullrequestreview-5361269858) · 2026-09-30T03:52:08Z · reviewed commit `e268423ba56131cc770b225ca51be05cf769c755`

```text
**Changes requested — one blocker** in PR #84 at `e268423`.

1. **[P2 · Spec blocker] Define migration recovery before freezing the contract.** [[tests.md:331](https://github.com/oangsa/TokTickIT/pull/84/files)](codex://review?pr=https%3A%2F%2Fgithub.com%2Foangsa%2FTokTickIT%2Fpull%2F84&path=docs%2Flab-04%2Ftests.md&line=331&side=right) covers duplicate-safe reruns; PG-02/DATA-02 cover successful upgrades. None defines or tests recovery after a failed/interrupted migration. Handout §5.2 explicitly requires this. Document rollback or forward recovery, then extend an existing planned test to verify preserved legacy data and exactly-once backfill after recovery. Keep its status **Not Run** for this documentation PR.

2. **Non-blocking contract mismatch:** [[api-spec.md:234](https://github.com/oangsa/TokTickIT/pull/84/files)](codex://review?pr=https%3A%2F%2Fgithub.com%2Foangsa%2FTokTickIT%2Fpull%2F84&path=docs%2Flab-04%2Fapi-spec.md&line=234&side=right) omits `isMigrated` from `ActionTakenListItemDTO`, while API-03 requires it in list results. Add `isMigrated: boolean` so the response contract matches its planned test.

**Standards:** no material violations found. Requirement/test ownership is complete; all 83 planned tests remain **Not Run**.

Reviewed the four contracts, Issue #77–83, preserved Lab 3 behavior, and the handout. Application tests/builds were not run; this PR changes documentation only. Nothing posted to GitHub.

Handout source: :codex-file-citation{path="C:/Users/kitti/CPE334/SE+Lab+4.pdf" purpose="source"}
```

#### Review by @kittipichcha — APPROVED

Source: [Review 5457872834](https://github.com/oangsa/TokTickIT/pull/84#pullrequestreview-5457872834) · 2026-10-08T14:08:10Z · reviewed commit `bd9e1cfd71ecb1169aed4ba57a9a4c12a8fdc8ec`

*Empty review body; no text was submitted.*

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #85 — feat: add Lab 4 data foundation and migration

[Pull request](https://github.com/oangsa/TokTickIT/pull/85)

#### Review by @kittipichcha — CHANGES_REQUESTED

Source: [Review 5375226460](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5375226460) · 2026-10-01T05:13:31Z · reviewed commit `2b560e49817a32048c0ca760b9b5bca8aa849e7e`

```text
<html>
<body>
<!--StartFragment--><html><head></head><body><h1><span>Verdict</span></h1><p><span>⚠️ </span><strong><span>Changes Requested</span></strong></p><p><span>PR #85 at head </span><code dir="ltr">2b560e49817a32048c0ca760b9b5bca8aa849e7e</code><span> has </span><strong><span>2 material blockers</span></strong><span>. I did not find another concrete implementation defect in the migration/schema/System-user/idempotency foundation after tracing the current head.</span></p><h1><span>Executive Summary</span></h1><p><span>The production implementation is substantially aligned with Issue #78 and the Lab 4 data-foundation requirements. The migration is additive and transactional, preserves Lab 3 data, creates the SYSTEM identity and truthful migration snapshots, backfills only eligible legacy </span><code dir="ltr">RESOLVED</code><span>/</span><code dir="ltr">CLOSED</code><span> Tickets, generalizes idempotency without dropping the Lab 2 claim behavior, and adds realistic idempotent seed data. The two follow-up migrations also now enforce typed Activity details while preserving the frozen Claim behavior.</span></p><p><span>The Lab 4 handout explicitly requires preservation of prior data plus a documented </span><strong><span>and tested</span></strong><span> migration recovery path. </span><span><span><span>    SE+Lab+4</span></span></span><span> The current migration/recovery test is materially stronger than the earlier version: it exercises a real failed Prisma migration state, verifies deployment remains blocked, resolves it, redeploys, and checks exactly-once backfill.</span></p><p><span>The remaining blockers are different:</span></p><div><div><div>
ID | Classification | Finding
-- | -- | --
B-01 | Requirement contradiction / test-contract integrity | PR #85 rewrites the frozen expected results of PG-02, PG-13, and DATA-02 so they no longer prove migrated Actions are excluded from resolution, then changes those rows to Pass. The frozen contract still requires that behavior in AC-34.
B-02 | Missing execution evidence | The current head claims 72 files / 1,065 tests, PostgreSQL tests, builds, migration status, etc., but GitHub exposes no test/build status or artifact for this SHA. The only workflow associated with the head is Project Automation, not verification. The reported Pass states therefore cannot be independently verified from available evidence.

</div></div></div><p><span>These are realistic paths derived from the migration, concurrency, identity, recovery, and workflow contracts; I did not treat theoretical cases as blockers.</span></p><h1><span>Security / Authorization Review</span></h1><p><span>The SYSTEM account boundary is implemented at multiple levels rather than relying on UI hiding. The migration makes the SYSTEM account inactive, prevents </span><code dir="ltr">mustChangePassword=true</code><span>, fixes it to the synthetic non-login credential, and enforces only one </span><code dir="ltr">is_system=true</code><span> user. </span><code dir="ltr">AuthService</code><span> adds </span><code dir="ltr">isSystem:false</code><span> to login/session resolution. User Management and assignable-owner reads also exclude SYSTEM.</span></p><p><span>The migration retains restrictive foreign keys. Action-Attachment associations additionally enforce same-Ticket/not-deleted evidence at the database layer, and Action Activity rows are constrained to the same Ticket as the referenced Action.</span></p><p><span>I found no committed credential, connection URL, or private key in the reviewed diff. The migration test deliberately sanitizes connection-string output and uses guarded disposable-target configuration.</span></p><p><span>No public Action mutation route is introduced by this PR, which is consistent with #78's scope; authorization for those mutations belongs downstream rather than being prematurely implemented here.</span></p><h1><span>Test and tests.md Review</span></h1><p><span>The actual </span><strong><span>test implementations</span></strong><span> are generally strong.</span></p><p><code dir="ltr">schema-contract.postgres.test.ts</code><span> tests more than row existence: it exercises missing typed children, wrong child families, null non-snapshot previous values, invalid Claim status pairs, child deletion/movement and parent-action changes. The current Claim regression is especially useful because it distinguishes assignment-only from assignment plus the permitted </span><code dir="ltr">NEW → OPEN</code><span> status child.</span></p><p><code dir="ltr">migration-upgrade.postgres.test.ts</code><span> now has two distinct recovery scenarios and verifies legacy row contents/relationships, not merely row counts. That meets the handout's requirement that recovery itself be documented and tested rather than assuming successful migration is enough. </span><span><span><span>    SE+Lab+4</span></span></span></p><p><code dir="ltr">seed-idempotency.postgres.test.ts</code><span> exercises two seed runs and checks the important logical counts. The seed contains all eight Ticket statuses, all priority levels, assigned/unassigned ownership, active/inactive/deleted users, explicit Planned/In-Progress/Completed/Cancelled Actions, multiple Actions on one Ticket, and an empty-ticket Requester.</span></p><p><span>The defect is therefore not “there aren't enough migration tests.” It is </span><strong><span>test-result integrity</span></strong><span>: the current PR changed the meaning of three frozen evidence rows to match what the implementation can currently prove.</span></p><h1><span>Regression Review</span></h1><p><span>The Lab 2 Ticket-create idempotency migration was traced through the full changed path:</span></p><p><span>existing record → migration renames </span><code dir="ltr">requester_id</code><span> to </span><code dir="ltr">user_id</code><span> → assigns </span><code dir="ltr">POST /api/users/me/tickets</code><span> → retains old body-only </span><code dir="ltr">request_hash</code><span> → </span><code dir="ltr">runCreateTicket</code><span> computes new and legacy hashes → </span><code dir="ltr">IdempotencyService.resolve()</code><span> accepts the legacy hash → completed Ticket result is replayed.</span></p><p><span>That is a sensible compatibility strategy and avoids rewriting historical claim hashes.</span></p><p><span>Lab 3 authentication regression risk was also addressed: SYSTEM is excluded from login/refresh/context but normal users continue through the existing paths. Inherited auth and staff-queue tests were updated specifically for this new field rather than broadly rewritten.</span></p><p><span>I found no static regression contradiction in those paths. The remaining regression limitation is B-02: the claimed full </span><code dir="ltr">npm test</code><span> run cannot be independently verified.</span></p><h1><span>Scope / Future-Lab Review</span></h1><p><span>Scope is controlled well. PR #85 implements the data/migration foundation rather than prematurely adding the full Actions REST API, Actions UI, Dashboards, or final Ticket workflow.</span></p><p><span>That is consistent with the handout's staged Lab 4 decomposition, which separately calls out the Actions foundation, UI, Ticket workflow, role dashboards, and final hardening work. </span><span><span><span>    SE+Lab+4</span></span></span></p><p><span>The two Activity validator follow-up migrations are still foundation work because they enforce invariants on the schema introduced here. They do not implement Issue #81's workflow route.</span></p><p><span>The mistake is not that #81 code is absent. It is the current documentation claiming complete success for frozen #78 test rows whose expected result reaches into that downstream behavior.</span></p><h1><span>Documentation Review</span></h1><p><code dir="ltr">docs/lab-04/ai-use.md</code><span> now contains seven selected prompt/result entries, which is within the handout's requested 6–10 selected prompts. The final submission also requires a brief “My Reflection”; that is a final-release requirement and can remain owned by #83 rather than blocking this foundation PR. The handout describes that final AI-use requirement at submission time. </span><span><span><span>    SE+Lab+4</span></span></span></p><p><span>The added </span><code dir="ltr">specification.md</code><span> explanation of typed Activity child constraints is compatible with the frozen API after the Claim fix; I do not see a separate semantic conflict there.</span></p><p><code dir="ltr">tests.md</code><span>, however, requires correction under B-01 because it is functioning as an acceptance contract, not merely an informal implementation diary.</span></p><h1><span>Evidence / Release Verification</span></h1><p><span>Current GitHub state reviewed:</span></p><p><span>PR </span><code dir="ltr">#85</code><span> → base </span><code dir="ltr">lab4-staging@dae51160</code><span> → head </span><code dir="ltr">feature/78-lab4-data-foundation-migration@2b560e49</code><span>.</span></p><p><span>The PR has 35 changed files and five commits. I checked the complete changed-file set, production patches, migration SQL, seed, service changes, Lab 2/3 regression adjustments, all three Lab 4 PostgreSQL tests, the PR/Issue descriptions, current frozen documents, review history, commit statuses and workflow run.</span></p><p><span>There are currently no PR review submissions, inline review threads, or conversation comments returned by GitHub. There is also no test/build CI status attached to the current head. The one workflow run is project-board automation only.</span></p><p><span>So the code review can validate the implementation </span><strong><span>statically</span></strong><span>, but it cannot legitimately convert the author-recorded run claims into independently verified </span><code dir="ltr">Pass</code><span> evidence.</span></p><h1><span>Verification Performed</span></h1><p><span>I followed the supplied </span><code dir="ltr">review-pr</code><span> pipeline's requirement to review the complete scope rather than stopping at the first defect. It explicitly requires Scrutinize, code-quality/standards checks, thermonuclear review, the full PR pass, then a consolidated verdict. </span><span><span><span>   skill</span></span></span></p><p><span>I used the supplied Scrutinize source to do the outsider/simpler-alternative and end-to-end trace pass; its uploaded snippet points to the repository containing that skill. </span><span><span><span>   Link-to-scrutinize-skill</span></span></span><span> I also fetched and applied the thermonuclear skill referenced by the other supplied snippet. </span><span><span><span>   Link-to-thermo-nuclear-code-qua…</span></span></span></p><p><span>The exact </span><code dir="ltr">review-agent</code><span> and </span><code dir="ltr">code-review</code><span> skill files named by </span><code dir="ltr">review-pr</code><span> were not included in the supplied snippets or available in the installed skill set. I therefore performed the two described axes directly: full changed-path defect inspection, followed by repository Standards → frozen Spec validation. This is a review-coverage limitation, but it does not affect the present non-approval verdict.</span></p><p><span>The review was pinned to the exact head/base revisions rather than current branch names alone. I also checked all changed production TypeScript line counts for the thermonuclear decomposition threshold; none crosses 1,000 lines.</span></p><h1><span>Required Next Steps</span></h1><ol start="1"><li><strong><span>Fix B-01 first:</span></strong><span> restore PG-02, PG-13 and DATA-02 to the frozen expected behavior/status semantics, or obtain an explicit approved Sprint 4 contract amendment separating foundation evidence from downstream resolution-gate evidence. Do not label the original frozen rows fully </span><code dir="ltr">Pass</code><span> merely because </span><code dir="ltr">isMigrated=true</code><span> persists.</span></li><li><strong><span>Preserve the good migration/recovery implementation.</span></strong><span> I do not see a need to rewrite the migration just to address B-01; this is primarily a contract/evidence correction unless the team decides #78 really must execute the resolution behavior.</span></li><li><strong><span>Provide current-head execution evidence</span></strong><span> for </span><code dir="ltr">2b560e49</code><span>: Lab 4 PG suite, full server suite, server/client builds, guarded migration status and </span><code dir="ltr">git diff --check</code><span>, tied to that SHA.</span></li><li><span>Then re-review B-01/B-02 plus the affected regression paths. If those two items close without introducing another defect, I did not identify another static blocker in this review.</span></li></ol></body></html><!--EndFragment-->
</body>
</html>

```

#### Review by @kittipichcha — CHANGES_REQUESTED

Source: [Review 5376116219](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5376116219) · 2026-10-01T07:20:08Z · reviewed commit `eb65745edb8c9cbccc5effccd25adca544f4573e`

```text
PR #85 current head eb65745 — Changes Requested, 2 blockers remain.
1. Resolve the frozen #78/#81 acceptance-contract contradiction and synchronize all acceptance sources.
tests.md correctly restores PG-02, PG-13, and DATA-02 and marks them Blocked, so the previous test-contract rewrite is fixed. However, frozen #77 assigns those complete rows/AC-34 to #78 while their runtime resolution-exclusion behavior is implemented by downstream #81, which itself depends on #79 after #78. Issue #78 and the PR description still claim the opposite foundation-only close rule and still report these rows as Pass. Obtain an explicit approved contract decision that either splits the foundation/runtime evidence ownership or changes the dependency/ownership model, then synchronize #77/#78/tests.md/PR description.
2. Publish independently inspectable execution evidence.
verification-2b560e49.md records a good local run, and no application rerun is necessary merely because eb65745 changes documentation only. However, the report explicitly says the raw logs remain local and no CI/status/artifact exists. Publish the already-created sanitized log/checksum bundle or provide a CI run so the PostgreSQL tests, full server suite, server/client builds, migration status, and git diff --check can be independently verified.
No additional implementation blocker was found in the current-head delta.
```

#### Review by @kittipichcha — APPROVED

Source: [Review 5376698442](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5376698442) · 2026-10-01T08:16:27Z · reviewed commit `db289c8fea834b1fbe153649ece95936a5cda17c`

*Empty review body; no text was submitted.*

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #86 — Actions Taken backend and REST API

[Pull request](https://github.com/oangsa/TokTickIT/pull/86)

#### Review by @kittipichcha — APPROVED

Source: [Review 5380711161](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5380711161) · 2026-10-01T14:27:28Z · reviewed commit `cc5473bd2e3962a4caafd828ea323b7ec1776298`

*Empty review body; no text was submitted.*

#### Review by @kittipichcha — CHANGES_REQUESTED

Source: [Review 5380722307](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5380722307) · 2026-10-01T14:28:21Z · reviewed commit `cc5473bd2e3962a4caafd828ea323b7ec1776298`

```text
<html>
<body>
<!--StartFragment--><h3><span>B-01 — Frozen #77 still assigns PG-10 to #79 while the current contract assigns it to #81</span></h3><p><strong><span>Classification:</span></strong><span> P2 · requirement/contract contradiction · Blocking.</span></p><p><span>The repository now contains two incompatible ownership statements:</span></p><p><strong><span>Frozen Issue #77</span></strong><span> still says, under </span><strong><span>Primary Test ownership</span></strong><span>, that </span><strong><span>PG-10 belongs to #79 with #81 Ticket-mutation cases</span></strong><span>. It lists PG-10 among #79's planned Test IDs and omits it from #81.</span></p><p><span>In contrast, PR #86's current </span><code dir="ltr">specification.md</code><span> §14 says </span><strong><span>#81 owns complete PG-10 execution and final status</span></strong><span>, </span><code dir="ltr">tests.md</code><span> keeps the global row Blocked for #81, Issue #79 says it has no global PG-10 acceptance row, and Issue #81 explicitly says it owns PG-10 globally.</span></p><p><span>This matters because #80 depends on #79 and #81 depends on #80. If the frozen #77 model continues to make complete PG-10 a #79 closure requirement while PG-10 cannot finish until #81 implements Requester confirmation, the project again has the effective chain:</span></p><p><code dir="ltr">#79 needs PG-10 from #81 → #80 needs #79 → #81 needs #80</code></p><p><span>That is precisely the circular acceptance dependency the current PR's final documentation commit is trying to eliminate.</span></p><p><span>The decision itself does </span><strong><span>not</span></strong><span> appear unresolved: </span><code dir="ltr">ai-use.md</code><span>, </span><code dir="ltr">specification.md</code><span>, Issue #79, Issue #81, and the PR consistently record the intended new decision. The problem is that the highest-level frozen ownership source was not synchronized. Therefore this is </span><strong><span>Changes Requested</span></strong><span>, not Needs Discussion.</span></p><p><strong><span>Current behavior:</span></strong><span> #77 says PG-10 → #79; all newer sources say complete PG-10 → #81.</span></p><p><strong><span>Required behavior:</span></strong><span> one authoritative ownership model across #77, specification, tests.md, #79, #81, and PR description.</span></p><p><strong><span>Smallest remediation:</span></strong><span> update Issue #77's Primary Test ownership so PG-10 is removed from #79 and added to #81, and explicitly record that #79's passed Action-mutation atomicity work is only a contribution and not its closure gate. While editing #77, verify the AC-19/20 wording cannot be interpreted as making complete downstream PG-10 a reverse #79 closure dependency. No production-code or test-code change is required.</span></p><p><strong><span>Verification:</span></strong><span> search all living contract/Issue sources for </span><code dir="ltr">PG-10</code><span>; there should be exactly one complete owner/final-status owner, #81, with #79 described only as a contributor. Confirm #79 → #80 → #81 remains a one-way implementation chain.</span></p><h1><span>Non-Blocking Findings</span></h1><div><div><div>
ID | Finding | Impact / disposition
-- | -- | --
NB-01 | /api/users/assignable is now paginated with default page size 10, while existing StaffTicketQueue.tsx and StaffTicketDetail.tsx still make one unpaged request. | A real temporary staging regression: owner selection cannot reach eligible Users beyond page 1. Explicitly assigned to #80, so not a #86 blocker. Must be fixed before final regression.
NB-02 | PR validation text still says the 1,327-test evidence is local/not independently reproduced. | Exact-head CI now exists. Update the PR description to link run 36861468831; documentation clarity only.
NB-03 | Lab 3 staff-queue.api.test.ts still calls its lookup test “exposes no account details” even though the new approved DTO intentionally includes email. | Assertions are correct; test name is stale. Rename to something like “exposes only approved lookup fields.”
NB-04 | docs/lab-04/ai-use.md currently contains substantially more than the final handout's requested 6–10 selected key prompts. | Not #79's closure scope; #83 owns final curation. Do not forget this at submission. The final handout specifically asks for 6–10 selected prompts plus reflection.     SE+Lab+4
NB-05 | Exact-head CI's dependency install reports existing npm-audit findings, including high/critical severity entries. | No dependency files changed in #86, so I do not attribute these to this PR. #83 final hardening should triage whether any are reachable/material rather than treating severity labels alone as proof of a product vulnerability.

</div></div></div><!--EndFragment-->
</body>
</html>
```

#### Review by @kittipichcha — APPROVED

Source: [Review 5381113563](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5381113563) · 2026-10-01T14:57:02Z · reviewed commit `8a2f286e78ed4d1c3af99a7e2b2ccdc9d9b21d1f`

*Empty review body; no text was submitted.*

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #87 — Actions Taken UI & Global Lookup

[Pull request](https://github.com/oangsa/TokTickIT/pull/87)

#### Review by @kittipichcha — APPROVED

Source: [Review 5389733591](https://github.com/oangsa/TokTickIT/pull/87#pullrequestreview-5389733591) · 2026-10-02T08:30:46Z · reviewed commit `1ccd27d9145850b0ed3f058f482640494d4b206d`

```text
Approve however there's catch because I can't verify the result of 
<html>
<body>
<!--StartFragment--><html><head></head><body>
ID | Classification | Finding
-- | -- | --
B-01 | Missing mandatory execution evidence | Publish independently reviewable Issue #80 Lab 4 browser evidence before merging. docs/lab-04/tests.md marks RESP-03 Pass, and Issue #80 requires browser screenshots/keyboard-focus evidence plus real-server Action UI integration. The source test e2e/lab-04/responsive-visual.spec.ts is substantive and covers all 3 roles × 3 required viewports, overflow, mobile modal fit, historical-user Lookup, focus restoration, and Requester read-only behavior. But the evidence file explicitly says those screenshots are local ignored artifacts. Current exact-head CI run 36976953622 executes only Lab 3 Playwright and exposes only a lab3-playwright-report artifact. The real Actions smoke is likewise recorded only as a local run. Therefore the reviewer cannot independently verify the #80 browser Pass claim.


</body></html><!--EndFragment-->
</body>
</html>
```

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #88 — feat: enforce ticket workflow and Action-based resolution

[Pull request](https://github.com/oangsa/TokTickIT/pull/88)

#### Review by @kittipichcha — APPROVED

Source: [Review 5392749066](https://github.com/oangsa/TokTickIT/pull/88#pullrequestreview-5392749066) · 2026-10-02T14:05:24Z · reviewed commit `18567066c09567c360df685239e68b688c7e7207`

```text
Verdict
✅ Approved
Status to give your partner: Approved for merge into lab4-staging at reviewed head 18567066c09567c360df685239e68b688c7e7207.
I found no material Blocking finding against Issue #81, the frozen Lab 4 contract, the Lab 4 handout, the implementation, or the executed evidence. I found one low-impact non-blocking UI race worth fixing, but the backend remains authoritative and prevents an invalid state from committing.
PR #88 is currently 4 commits ahead / 0 behind lab4-staging, and GitHub reports it mergeable. The dependency chain is clean rather than circular: #77 → #78 → #79 → #80 → #81 → #82 → #83. PRs #84–#87 for the preceding four issues are already merged into lab4-staging, so #88 is based on the correct integrated predecessor state.
```

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #89 — feat: add role dashboards

[Pull request](https://github.com/oangsa/TokTickIT/pull/89)

#### Review by @kittipichcha — APPROVED

Source: [Review 5399665042](https://github.com/oangsa/TokTickIT/pull/89#pullrequestreview-5399665042) · 2026-10-03T08:10:51Z · reviewed commit `3113f3b562916bffc9be70c1e899b1c2b520f908`

```text
Approve 
However there's one document that you should consider before merge to lab4-staging the #82 Dashboard implementation and current-head CI look good, but PR #89 and Issue #82 still identify the older 6e855d0 revision/run as the current verified head. Current head 3113f3b already has successful exact-head CI run 37096940836 (server 1,448 tests, client 450, browser 101 passed/1 #83-owned skip, builds and PG-12 passed). Update the live PR/Issue evidence attribution to that SHA/run; no application-code fix is required.
```

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

### PR #90 — test: verify Lab 4 integration and release gates (#83)

[Pull request](https://github.com/oangsa/TokTickIT/pull/90)

#### Review by @kittipichcha — COMMENTED

Source: [Review 5454660524](https://github.com/oangsa/TokTickIT/pull/90#pullrequestreview-5454660524) · 2026-10-08T09:44:00Z · reviewed commit `74161965341cf2c182f1384c3a9cd6672a1087a9`

```text
**PR #90 review status: Verification hold — no confirmed code blockers.**

The implementation and test changes look consistent with Issue #83 and the Lab 4 contract. GitHub CI passed 1,449 server tests, 455 client tests, 110 E2E tests, and both builds. The migration/recovery, security, and performance evidence is present.

Before approving PR #90, we still need an independent visual inspection of the 69 committed screenshots for responsive layout, clipping, overlap, and legibility. There is one non-blocking maintainability suggestion to split the large API security test.

After approval, PR #90 can proceed into `lab4-staging`. However, final Lab 4 release remains pending until the historical PR #84 review record is reconciled and the integrated staging-head release gates pass. This PR should not be represented as final release approval.
```

#### Review by @kittipichcha — APPROVED

Source: [Review 5459152489](https://github.com/oangsa/TokTickIT/pull/90#pullrequestreview-5459152489) · 2026-10-08T15:35:42Z · reviewed commit `b4fac10953455db4584f8cc8ba3fba0bebd40fb8`

*Empty review body; no text was submitted.*

**My posted reply:** No author conversation comment or inline reply was recorded on this PR.

## Pull Requests I reviewed for my partner

| PR | Branch | Review history | PR status |
|---|---|---|---|
| [#58](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58) | `feature/lab4-contract-spec-dd` | Changes Requested; Changes Requested; Changes Requested; Changes Requested; Changes Requested; Approved | Merged into `lab4-staging` |
| [#59](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59) | `feature/lab4-actions-taken-foundation` | Changes Requested; Approved | Merged into `lab4-staging` |
| [#60](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60) | `feature/lab4-actions-taken-ui` | Changes Requested; Approved | Merged into `lab4-staging` |
| [#61](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/61) | `feature/lab4-ticket-workflow` | Approved | Merged into `lab4-staging` |
| [#62](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62) | `feature/lab4-role-dashboards` | Approved | Merged into `lab4-staging` |
| [#63](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63) | `feature/lab4-integration-release` | Approved | Open |

### PR #58 — docs(lab4): define Sprint 4 engineering contract

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58)

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5341087376](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5341087376) · 2026-09-28T15:40:36Z · reviewed commit `8aa7637f326a0c0c2d9750f51510f175411e8226`

````text
# PR #58 Review — Lab 4 Sprint Contract

## Verdict

**Request Changes**

I reviewed PR #58 against:

- `SE+Lab+4.pdf`
- the Issue #50 objective and Definition of Done
- the integrated Lab 3 baseline
- the four Lab 4 contract files:
  - `docs/lab-04/specification.md`
  - `docs/lab-04/api-spec.md`
  - `docs/lab-04/ui-spec.md`
  - `docs/lab-04/tests.md`

Overall, the PR is close to being ready to freeze. It correctly remains documentation-only, keeps all Lab 4 tests as `Planned`, defines FR/BR/AC IDs, and maps `AC-01` through `AC-25` to planned executable tests.

However, several contract-level issues should be resolved before dependent implementation issues begin.

---

## 1. Ticket status history is not fully specified for the handout's append-only evidence requirement

`specification.md §11` interprets the handout's **"append-only Ticket behavior"** as immutable `TicketStatusChange` history.

That interpretation is reasonable, but the current contract does not define:

- who can read Ticket status history;
- whether Requesters can see it;
- where it is exposed;
- whether a dedicated API is required;
- the deterministic ordering of history records;
- how the UI demonstrates it;
- which test proves role-appropriate visibility.

The handout's Part 7 explicitly asks for evidence of:

- stable ordering;
- append-only behavior;
- role-appropriate visibility.

If `TicketStatusChange` is the approved interpretation, please freeze the remaining behavior. For example:

```text
Ordering:
changedAt ASC, id ASC

Visibility:
IT Staff / Administrator: full status history
Requester: either explicitly permitted restricted history or explicitly no history
```

Then add corresponding API/UI/E2E evidence.

Otherwise, choose and document another interpretation of the handout phrase.

---

## 2. Ticket transition wording risks contradicting the frozen Lab 3 authorization rule

The Lab 4 Ticket transition section currently says:

> All rows require an existing, owned Ticket and IT Staff or Administrator.

The term **"owned Ticket"** is ambiguous here.

The integrated Lab 3 contract explicitly established that a status transition requires:

```text
ticketOwnerId != null
```

It does **not** require:

```text
ticketOwnerId == actingUserId
```

Once a Ticket has a primary owner, any authorized IT Staff or Administrator may perform a permitted status transition.

Please make this explicit in Lab 4, for example:

```md
A Ticket must have a non-null primary Ticket Owner before a formal status
transition. The acting IT Staff/Administrator does not need to be that Ticket's
specific primary owner.
```

This should also be reflected in `tests.md` so implementation cannot accidentally reintroduce the old same-actor restriction.

---

## 3. Stale-update protection does not cover all Ticket workflow mutations

Lab 4 adds:

```text
Ticket.version
expectedVersion
```

for formal Ticket status changes.

That is good, but the existing Lab 3 baseline still contains other workflow-changing mutations:

- Ticket owner assignment/reassignment;
- IT Priority updates.

The current Lab 3 owner operation is explicitly last-write-wins and has no version protection.

The Lab 4 handout requires the API contract to define how concurrent/stale updates are handled so one user does not unknowingly overwrite another user's recent workflow change.

At the moment this protection applies only to:

```text
PATCH status
```

and not to:

```text
POST owner
PATCH priority
```

Please either:

### Option A — recommended

Extend the same additive Ticket version contract to:

```text
POST /api/staff/tickets/:ticketNumber/owner
PATCH /api/staff/tickets/:ticketNumber/priority
PATCH /api/staff/tickets/:ticketNumber/status
```

with:

- optional `expectedVersion` for compatibility;
- Lab 4 UI always sending the latest version;
- every successful workflow mutation incrementing `Ticket.version`;
- stale version returning `409 CONFLICT`;
- tests covering competing owner / priority / status mutations.

### Option B

Define another explicit concurrency strategy that prevents silent overwrite.

Leaving owner and IT Priority as silent last-write-wins leaves the handout's stale-update requirement incomplete.

---

## 4. Action creation idempotency still leaves implementation decisions open

The API contract requires:

```text
Idempotency-Key
```

with:

- actor + route scoping;
- same request replay returning the same Action;
- changed payload returning `409 CONFLICT`;
- retention of at least 24 hours.

However, the contract does not yet define the persistence model, and the phrase:

```text
canonical request
```

is underspecified.

Please freeze what is actually compared.

For example, clarify whether canonicalization occurs after:

- trimming text;
- applying defaults;
- converting blank optional fields to `null`;
- ignoring unknown fields;
- normalizing omitted vs explicit `null`;
- validating `followUpRequired`;
- validating/normalizing `assigneeUserId`.

Example ambiguity:

```json
{
  "description": "Fix router",
  "followUpRequired": false
}
```

versus:

```json
{
  "description": "  Fix router  ",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": null,
  "assigneeUserId": null
}
```

The contract should say whether these are considered the same canonical request.

Also define the storage decision, e.g. an idempotency record containing:

```text
actorId
route
key
canonicalRequestHash
actionId
response/status
createdAt
expiresAt
```

with an appropriate uniqueness constraint.

This issue's goal says implementation issues should not have to invent missing material behavior, so this belongs in the contract.

---

## 5. Contract and planned-test precision issues

### 5.1 Ticket-number example is inconsistent with the Lab 3 baseline

The Action API example currently uses:

```text
TK-2026-0001
```

The established Lab 3 ticket-number contract is:

```text
TKT-YYYY-######
```

For example:

```text
TKT-2026-000001
```

Please update the Lab 4 examples so documentation remains consistent with the existing product contract.

### 5.2 Action-detail GET route has no explicit API test

The contract introduces:

```http
GET /api/tickets/:ticketNumber/actions/:actionId
```

but there is no dedicated planned assertion that clearly verifies:

- valid Action detail retrieval;
- Action belongs to the supplied Ticket;
- Action ID from another Ticket returns `404`;
- missing Action returns `404`;
- Requester ownership projection;
- Staff projection.

`API-ACT-05` currently focuses primarily on the list behavior.

Please either extend that row explicitly or add a dedicated test such as:

```text
API-ACT-DETAIL-01
```

so every new endpoint has executable contract evidence.

### 5.3 Performance-smoke assertion is still deferred

`PERF-01` says:

> finish under a recorded local smoke threshold defined before execution

That means a later implementation issue still has to decide what constitutes pass/fail.

Because Issue #50 owns Test DD, the threshold rule should be frozen here.

It does not need to be a production SLA, but the test needs a deterministic assertion.

For example:

```text
Environment:
local PostgreSQL test database using the documented seeded representative dataset

Execution:
5 warm-up requests + 20 measured requests

Pass rule:
p95 < X ms

Payload:
dashboard summary response remains below Y KiB
```

The actual numbers are your team's decision, but they should be defined before implementation begins.

---

## 6. Reconsider modifications to completed Lab 3 documentation

This PR modifies:

```text
docs/lab-03/tests.md
docs/lab-03/ai-use.md
```

only to record the Lab 4 contract drafting activity.

The Issue #50 scope is the Lab 4 contract, while Lab 3 is being used as the integrated baseline.

`docs/lab-04/ai-use.md` already records the Lab 4 AI activity.

Unless there is a specific course or repository governance requirement saying that work on a later Lab must also be appended to the previous Lab's evidence files, I recommend reverting these two changes.

That keeps completed Lab 3 evidence immutable and keeps Lab 4 work under:

```text
docs/lab-04/
```

---

## What is already in good shape

The following parts of the PR are well defined and should be preserved:

- Action performer, assignee, and Ticket Owner are treated as separate identities.
- New Actions are server-created as `PENDING`.
- Action lifecycle is clearly defined as:

```text
PENDING -> COMPLETED
PENDING -> CANCELLED
```

with terminal completed/cancelled states.

- Completion requires a nonblank Result.
- Follow-Up Required correctly requires Follow-Up Note.
- Requesters see Actions read-only without audit metadata or internal notes.
- Action revisions are immutable.
- The backend resolution gate blocks `IN_PROGRESS -> RESOLVED` while any Action is Pending.
- Zero Actions do not block resolution.
- Concurrent Action updates use version-based stale-write detection.
- Action creation vs Ticket resolution has a planned race-condition test.
- Dashboard calculations are backend-authoritative.
- The rolling seven-day UTC window is explicitly defined.
- Legacy Resolved Tickets with unknown `resolvedAt` are not assigned fabricated timestamps.
- Dashboard drill-down filters are substantially specified.
- Migration is additive and intended to preserve the Lab 3 baseline.
- All `AC-01` through `AC-25` currently map to at least one planned test.
- No Lab 4 executable test is incorrectly marked `Passed`.
- No feature implementation is included in this PR.

---

## Requested changes before approval

Please resolve the following before freezing the Lab 4 contract:

1. Define Ticket status-history visibility, ordering, API/UI exposure, and executable evidence for the handout's append-only requirement.
2. Explicitly preserve the Lab 3 rule that a Ticket must be assigned, but the acting Staff/Admin does not have to be its specific owner.
3. Close the concurrency gap for Ticket owner and IT Priority workflow mutations.
4. Fully define Action-create idempotency canonicalization and persistence.
5. Fix the Ticket-number example, add explicit Action-detail endpoint coverage, and freeze the performance-smoke assertion.
6. Revert the Lab 3 documentation edits unless there is an explicit requirement to modify prior-lab evidence.

After those points are reconciled, the contract should be in a much safer state to approve before Lab 4 #2–#6 begin.

````

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5352441580](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5352441580) · 2026-09-29T12:18:14Z · reviewed commit `1505e8af80b47d21ac1e5e4c223f40e8c6565d60`

````text
# PR #58 Re-Review — Lab 4 Sprint Contract

**PR head reviewed:** `1505e8af80b47d21ac1e5e4c223f40e8c6565d60`

## Verdict

**Request Changes — much closer; the previous six findings are substantially addressed, but a few contract-level gaps remain before the contract should be frozen.**

The revision successfully addresses the previous review by adding formal Ticket status history, clarifying that the acting Staff/Admin does not need to be the Ticket Owner, extending shared Ticket versioning to owner/priority/status writes, fully specifying Action-create idempotency, correcting the Ticket-number example, adding Action-detail coverage, freezing the dashboard performance-smoke threshold, and keeping Lab 4 evidence out of the completed Lab 3 logs.

No feature/runtime implementation is introduced in this PR; the changed files remain documentation/governance files.

---

## Remaining blocking findings

### 1. Dashboard navigation and active-page indication are still missing from the UI contract and tests

The Lab 4 handout explicitly requires role-appropriate **Dashboard navigation** and a clear **active-page indication**.

`docs/lab-04/ui-spec.md` defines role landing dashboards and preserves the existing shell/navigation, but it never freezes the new Dashboard navigation item or how the active state is shown.

Please define:
- where `Dashboard` appears for Requester;
- where it appears for IT Staff/Admin;
- which dashboard destination each role gets;
- how the active item is indicated;
- the mobile navigation behavior.

Add a planned assertion in `UI-DASH-01`, `E2E-02`, or the keyboard/navigation test.

---

### 2. The Staff Dashboard response shape is still internally ambiguous

In `docs/lab-04/api-spec.md §11`, the prose says `byStatus` and `byPriority` contain matching drill-downs for every enum value.

However, the documented response shape shows only:

```json
"byStatus": {
  "NEW": {
    "path": "/api/staff/queue",
    "query": { "status": "NEW" }
  }
},
"byPriority": {
  "HIGH": {
    "path": "/api/staff/queue",
    "query": { "priority": "HIGH" }
  }
}
```

Because this file is supposed to freeze exact response shapes, please either show all entries or explicitly mark the JSON as abbreviated and define the exact mapped-object type.

There is also an Action drill-down ambiguity:

```json
"myPendingAssignedActions": {
  "path": "/api/tickets/:ticketNumber",
  "anchor": "actions",
  "actionId": 1,
  "filter": { ... }
}
```

A metric can represent multiple Actions, so a single card-level `actionId` cannot represent the set. Freeze one model:
- destination per Action list item;
- a real filtered Action-list destination; or
- no card-level drill-down, with only the bounded Action rows being actionable.

---

### 3. Planned UI/E2E coverage does not explicitly cover the full Working Actions Taken UI evidence

The handout requires the UI demonstration to include list, create, assign, edit, status transition, complete, cancel, validation, inactive-assignee rejection, role restrictions, safe failures, responsive behavior, and different Actions on one Ticket.

Current API rows cover cancellation and inactive assignees, but the UI/E2E rows do not explicitly prove them:
- `UI-ACT-01` does not explicitly mention complete/cancel/inactive assignee;
- `E2E-01` includes complete but not cancel or inactive-assignee rejection.

Please expand `UI-ACT-01` and/or `E2E-01` to explicitly cover:
- completing one Action;
- cancelling another;
- rejecting an inactive assignee through the UI;
- at least two different Actions under the same Ticket.

---

### 4. The authorization matrix is no longer complete after adding status history

The revision adds `FR-20`, `BR-31`, `AC-26`, and:

```http
GET /api/staff/tickets/:ticketNumber/status-history
```

but the Lab 4 authorization matrix does not include status-history access.

Add a row such as:

| Operation | Unauthenticated | Requester | IT Staff | Administrator |
| --- | --- | --- | --- | --- |
| View formal Ticket status history | — | No | Yes | Yes |

Also, the Ticket transition matrix still says:

> All rows require an existing, owned Ticket...

Elsewhere the contract correctly says the Ticket only needs a non-null primary owner and the acting Staff/Admin does not need to be that owner. Replace the matrix wording with something explicit such as:

> All rows require an existing Ticket with a non-null primary Ticket Owner and an authorized IT Staff/Administrator actor.

---

### 5. Final hardening requirements are not fully traceable into planned tests

The handout explicitly requires:
- console errors removed;
- broken links removed;
- placeholder text and unfinished controls removed;
- README setup, seed, migration, test, and demonstration instructions kept current.

`REG-01` currently focuses on prior-lab functional regression.

Please extend `REG-01` or add a final-hardening row for:
- browser console errors;
- broken links/navigation;
- placeholder/unfinished controls;
- README setup/seed/migration/test/demo instructions.

---

### 6. Freeze new-model indexes more precisely in `specification.md §7`

The handout explicitly requires the contract to determine indexes.

The current Data Changes section freezes the Action `(ticketId, createdAt, id)` index, but other new indexes remain described only generically.

Please freeze the intended indexes/unique constraints for at least:
- Action lookup/order by Ticket;
- Pending Actions by assignee;
- recent Actions by performer;
- Action revisions by Action;
- Ticket status history by Ticket and chronological order;
- `ActionCreateIdempotency` uniqueness and expiry cleanup.

If existing Ticket indexes are sufficient for a dashboard query, state that decision explicitly.

---

## Process cleanup

The PR body currently says:

> Final contract review: blocker-free.

GitHub still has the previous human review in **Changes Requested**, and `docs/lab-04/reviewer.md` correctly says re-review is pending.

Until re-review is complete, change that wording to something like:

> Author/agent contract audit: blocker-free; human re-review pending.

---

## Previous review findings that are now resolved

1. Append-only Ticket behavior now has a Staff/Admin history contract, ordering, UI, and tests.
2. The actor no longer needs to be the Ticket Owner.
3. Owner/priority/status mutations share `Ticket.version`.
4. Action-create idempotency is deterministic and durable.
5. Ticket identifier, Action-detail coverage, and performance-smoke precision are fixed.
6. Lab 4 evidence is no longer appended to completed Lab 3 logs.

The migration/recovery contract is also considerably stronger and matches the seven Lab 3 migration directories in the integrated baseline.

---

## Requested changes before approval

1. Freeze Dashboard nav placement/active state and test it.
2. Remove ambiguity from Staff Dashboard drill-down response shapes.
3. Expand UI/E2E assertions for Action cancel, inactive assignee rejection, and multiple Actions.
4. Add status-history authorization to the matrix and remove the ambiguous `owned Ticket` wording.
5. Add explicit final-hardening evidence.
6. Freeze the remaining new-model indexes/unique constraints.
7. Update the PR body to reflect pending human re-review.

After those are reconciled, I would be comfortable re-reviewing the PR for approval.

````

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5361703082](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5361703082) · 2026-09-30T05:03:41Z · reviewed commit `c0bf709d10a9a0b0b796af49a0542cd5bc8e9e0c`

````text
## Verdict

**Request Changes**

This revision closes the previous re-review findings around Dashboard navigation, active-page indication, exact Staff Dashboard mappings, per-Action destinations, Action complete/cancel UI evidence, inactive-assignee rejection, status-history authorization, final hardening, and new-model indexes.

The contract is now very close to freeze-ready, but I still found three contract/test inconsistencies and two process/evidence cleanups that should be resolved before approval.

---

## Blocking findings

### 1. Same-value status writes contradict the Ticket transition matrix and Lab 3 compatibility

`docs/lab-04/specification.md` BR-30 says owner, priority, and status mutations increment the version on every successful request, including same-value writes. `docs/lab-04/api-spec.md §7` repeats this, and `API-WF-04` plans to assert successful same-value writes.

But the Ticket transition matrix says every unlisted transition is forbidden. `IN_PROGRESS -> IN_PROGRESS` is not listed. The integrated Lab 3 baseline also rejects any pair for which `isTransitionAllowed(currentStatus, targetStatus)` is false.

Recommended fix:

```md
Owner and IT Priority mutations may succeed when the requested value equals the
current value; if accepted, they increment Ticket.version exactly once.

Formal status changes remain governed by the Ticket transition matrix.
A request whose target status equals currentStatus is not a permitted transition
and returns 409 CONFLICT without mutation or version increment.
```

Update BR-30, API §7, AC-27 if necessary, and `API-WF-04`.

---

### 2. Actions Taken is paginated in the API, but the UI contract never defines how users reach all Actions

`GET /api/tickets/:ticketNumber/actions` is paginated (`page`, `pageSize`, maximum 50), while `ui-spec.md §3` only says to list all Actions in stable order.

Please define one UI behavior: Previous/Next, numbered pagination, or Load More. Freeze default page size, when controls appear, and what happens after create/edit. Add a planned pagination assertion to `UI-ACT-01` and/or `E2E-01`.

The handout says Requesters will see all Actions Taken items, so the UI contract should explain how all pages are reachable.

---

### 3. `API-ACT-02` is ambiguous about expired idempotency keys

`api-spec.md §4` clearly chooses:

> An expired key is atomically replaced by a fresh operation.

But `tests.md` `API-ACT-02` says:

> expired key is rejected/replaced atomically even before cleanup

`rejected/replaced` allows two outcomes, so it is not a deterministic executable assertion.

Recommended wording:

```text
After expiresAt, reuse of the same actor/route/key is treated as a fresh create:
a new Action is created and a new 201 response is returned even if the expired
idempotency row has not yet been removed by cleanup.
```

If rejection is intended instead, change the API contract too.

---

## Process / evidence cleanups

### 4. `reviewer.md` is missing the second human review, and the PR body overstates review status

GitHub currently shows two `CHANGES_REQUESTED` reviews by `@oangsa`:

- `#5341087376`
- `#5352441580`

`docs/lab-04/reviewer.md` records only the first one, even though the current head is explicitly a response to the second re-review.

Please record the second review, its verdict, reviewer identity, link, and responses.

The PR body also still says:

> Final contract review: blocker-free.

while the GitHub review state is still Changes Requested. Until approval exists, use wording such as:

```text
Author/agent contract audit: blocker-free.
Human re-review: pending.
```

---

### 5. `tests.md §6 Issue ownership` is stale for the newly added tests

The matrix now has new rows, but ownership still reflects the older set.

Please include at least:

```md
- Lab 4 #4 owns `API-WF-*`, `CONC-WF-*`, `UI-WF-*`, and the workflow portion of `E2E-01`.
- Lab 4 #6 owns `UI-STYLE-01`, `VISUAL-01`, `A11Y-01`, `REG-01`, `HARDEN-01`,
  integrated E2E execution, and final evidence/status reconciliation.
```

This prevents #2–#6 from having to decide test ownership later.

---

## Previous re-review findings now resolved

1. Role-specific Dashboard navigation and active-page behavior are frozen.
2. Staff Dashboard `byStatus` and `byPriority` define all enum keys.
3. Action metric cards and per-row destinations are no longer ambiguous.
4. UI/E2E coverage now includes multiple Actions, inactive-assignee rejection, completion, cancellation, blocked resolution, and final resolution.
5. Status-history authorization and Ticket-owner wording are fixed.
6. `HARDEN-01` covers README rehearsal, console/runtime errors, broken navigation, dead controls, and placeholders.
7. New Action/history/idempotency indexes and constraints are explicit.

All Lab 4 rows remain `Planned`; no runtime implementation or passing executable Lab 4 tests are claimed.

---

## Requested changes before approval

1. Resolve the same-value status write contradiction.
2. Define Actions Taken pagination behavior and tests.
3. Make expired-key behavior deterministic in `API-ACT-02`.
4. Record the second human review and correct the PR-body review-status wording.
5. Update Issue ownership for the newly added workflow and hardening tests.

After those are reconciled, the Sprint 4 contract should be ready for a final approval re-review.
````

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5374244874](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5374244874) · 2026-10-01T02:26:42Z · reviewed commit `86d5a57921d525668eb6bf5ee9d6e759b1bc810e`

````text
Verdict
Request Changes — the previous review findings are resolved, but three contract/test-design gaps remain before freeze.
The latest revision successfully resolves the prior review around same-status writes versus the Ticket transition matrix, Actions Taken pagination, expired idempotency-key reuse, human-review evidence, PR verification wording, and Lab 4 issue ownership.
The contract is now very close to approval. I found three remaining gaps that matter because Issue #50 is supposed to freeze exact API/UI behavior and executable Test DD before implementation.
---
1. Shared Ticket concurrency still does not freeze the exact owner/priority request and response shapes
`docs/lab-04/api-spec.md §7` says the existing owner, priority, and status endpoints accept optional `expectedVersion`, and successful mutation responses include `version`.
The status extension is explicit in §8:
```json
{ "status": "IN_PROGRESS" }
```
remains valid, and the successful response is:
```json
{ "data": { "currentStatus": "IN_PROGRESS", "version": 3 } }
```
But owner and priority are not given equivalent exact Lab 4 shapes.
The integrated Lab 3 baseline currently defines:
```json
POST /api/staff/tickets/:ticketNumber/owner
{ "ownerId": 5 }

PATCH /api/staff/tickets/:ticketNumber/priority
{ "itPriority": "HIGH" }
```
and their responses do not contain `version`.
Because Issue #50 explicitly owns exact request/response shapes and conditional updates, implementation should not have to decide whether `expectedVersion` is a JSON body field, query parameter, or header, or where the new `version` field is returned.
Please freeze the additive shapes explicitly, for example:
```json
POST /api/staff/tickets/:ticketNumber/owner
{ "ownerId": 5, "expectedVersion": 2 }

200
{ "data": { "ticketOwnerId": 5, "version": 3 } }
```
```json
PATCH /api/staff/tickets/:ticketNumber/priority
{ "itPriority": "HIGH", "expectedVersion": 2 }

200
{ "data": { "itPriority": "HIGH", "version": 3 } }
```
and show the status body with optional `expectedVersion` as well:
```json
{ "status": "IN_PROGRESS", "expectedVersion": 2 }
```
Keep the documented compatibility rule that omission remains valid for Lab 3 callers.
Also extend `API-WF-04` to assert the additive response shape, not only the persisted version increment.
---
2. Test DD does not explicitly cover several new API security and validation rules
The API contract is specific about these rules, but the planned test matrix currently has no explicit assertion for them:
CSRF enforcement on the new Action POST/PATCH routes;
required `Idempotency-Key`;
`Idempotency-Key` length / printable-ASCII bounds;
Action text maximum lengths:
Description / Result: 2,000;
Follow-up Note / Attachment Notes: 1,000;
invalid Action list `page` / `pageSize`;
invalid new Requester dashboard drill-down filters:
`scope`;
`updatedSince`;
`resolvedSince`;
invalid new Staff Queue extensions:
`ownerScope`;
`openOnly`;
`updatedSince`.
You do not necessarily need new test IDs. Existing rows can be strengthened:
`SEC-ACT-02`: missing/invalid CSRF on Action POST/PATCH is rejected with no mutation;
`API-ACT-02`: missing/invalid/overlength/non-printable idempotency keys;
`API-ACT-03`: exact text-length boundary tests;
`API-ACT-05`: invalid Action pagination;
`API-DASH-01` / `API-DASH-02`: invalid new dashboard/Queue filter values.
The important part is that these frozen contract rules have executable planned assertions before implementation begins.
---
3. Formal Ticket status-history pagination is still underspecified in the UI contract
The Actions Taken pagination gap is now fixed well.
However, the chosen `TicketStatusChange` history feature has the same remaining issue:
API §9 is paginated with `page`, `pageSize`, default 10, maximum 50;
`ui-spec.md §4` only says the history is shown in “paginated ascending chronological order”;
`UI-WF-HISTORY-01` only says it displays paginated history chronologically.
There is no frozen UI behavior for moving beyond the first page.
Since the contract chose formal status history as the evidence for the handout's stable-ordering / append-only / role-visibility requirement, please define how Staff/Admin can reach every history row.
The simplest option is to reuse the Actions pattern:
```text
pageSize = 10
Previous / Next
Previous disabled on first page
Next disabled on last page
Page X of Y
pagination hidden for zero/one page
```
Then extend `UI-WF-HISTORY-01` with a multi-page fixture such as 21 history rows.
---
Minor consistency cleanup
Two phrases could also be tightened while touching the contract:
`BR-25` currently says Action creation uses an idempotency key “or an equivalent server-side duplicate guard”, while `api-spec.md` specifically requires `Idempotency-Key`. The BR should match the frozen API rather than leaving an alternative implementation path.
`FR-02` says create an Action with “an initial Action status”, while BR-04/API §4 freeze the initial status as server-created `PENDING`. Consider saying “with server-set initial `PENDING` status” to avoid implying that the client supplies it.
---
Previous review findings now resolved
Same-status Ticket PATCH now returns `409` without version/history mutation.
Same-value owner/priority behavior is separated from formal status transitions.
Actions Taken UI now has fixed-size pagination and boundary behavior.
Expired idempotency keys deterministically create one fresh Action at/after expiry.
`reviewer.md` now records all three submitted human reviews.
The PR body no longer claims a blocker-free final human review.
Workflow/hardening test ownership is updated.
All Lab 4 executable rows remain `Planned`; no feature implementation or passing runtime result is claimed.
---
Requested changes before approval
Freeze exact Lab 4 owner/priority/status conditional-update request and response shapes.
Add planned security/validation assertions for the new API contract, especially CSRF, idempotency-key validation, input bounds, pagination, and new dashboard filters.
Freeze Staff/Admin status-history pagination behavior in `ui-spec.md` and `UI-WF-HISTORY-01`.
Preferably tighten `BR-25` and `FR-02` to match the already-frozen API behavior.
After these are reconciled, I would expect the contract to be ready for final approval re-review.
````

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5374801503](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5374801503) · 2026-10-01T03:56:49Z · reviewed commit `4c1e22f8a6ca43346534d5794e9d859569293aab`

````text
## Verdict

**Request Changes — almost freeze-ready.**

The current head resolves the previous review round very well. Exact owner/priority/status
`expectedVersion` request/response shapes are now frozen, the security/validation Test DD gaps
are covered, status-history pagination is fully specified, FR-02 and BR-25 are aligned with the
API, all Lab 4 rows remain `Planned`, and no runtime implementation or migration code is included.

I found two remaining contract/evidence inconsistencies and one minor validation wording issue.

---

## 1. `api-spec.md §1` contradicts its own Staff/Admin Action-read contract

The compatibility section currently says:

> `Requester dashboard and Action reads are Requester-only and ownership-scoped.`

Read literally, that makes **all Action reads Requester-only**.

But the same API contract later says:

- `GET /api/tickets/:ticketNumber/actions` is readable by IT Staff/Administrator and by an
  ownership-scoped Requester;
- `GET /api/tickets/:ticketNumber/actions/:actionId` uses the same role/ownership rules;
- Action writes are IT Staff/Administrator-only.

This also conflicts with the Lab 4 role model, where IT Staff create/update Actions Taken on
accessible Tickets and Administrator performs IT Staff behavior.

### Change requested

Replace the ambiguous sentence with explicit audience wording, for example:

```md
Staff Action reads/writes and Staff Dashboard reads are IT Staff/Administrator-only.
Requester Dashboard reads and Requester Action reads are Requester-only and ownership-scoped.
```

or:

```md
Action reads are available to IT Staff/Administrators for accessible Tickets and to Requesters
only for their own Tickets. Action writes remain IT Staff/Administrator-only.
```

This is a small edit, but authorization is a required exact API contract and should not contain
two mutually exclusive rules.

---

## 2. `reviewer.md` still says the corrected PR-body wording is unpublished, but the PR body is already corrected

The live PR body now says:

- human review is pending; and
- no runtime implementation is included.

That is the corrected state requested in the prior reviews.

However, `docs/lab-04/reviewer.md` still contains statements such as:

> `The local PR-body replacement below remains unpublished.`

and:

> `Proposed local PR-body replacement (not published)`

Those statements are now stale.

The review record is part of the required Lab 4 evidence, so it should describe the actual review
and response state rather than an earlier local-worktree state.

### Change requested

Update those response notes to say the PR body **has now been updated** to accurately state that
human re-review/approval remains pending.

The proposed unpublished replacement block can then be removed, or retained only as historical
text clearly labeled as superseded.

---

## 3. Minor: the API's global integer convention conflicts with field-specific positive bounds

`api-spec.md §1` currently says:

> `Integer IDs, versions, pages, and limits use non-negative decimal integer syntax.`

But later sections explicitly require:

- `page` to be a **positive** integer;
- `pageSize` to be at least 1;
- `expectedVersion` to be a **positive** integer;
- owner/assignee IDs to be positive where supplied.

That leaves `0` simultaneously allowed by the global convention and invalid by the endpoint
contracts.

### Change requested

Tighten the global wording, for example:

```md
Integer fields use decimal integer syntax. IDs, versions, page numbers, page sizes, and limits
must satisfy the positive/range constraints defined by their endpoint; zero is invalid where the
field is documented as positive.
```

The existing endpoint-specific rules and planned tests can remain unchanged.

---

## Previous review findings now resolved

The current head successfully resolves the previous review:

1. Exact owner, priority, and status conditional-update bodies and success responses are frozen.
2. Lab 3 callers may omit `expectedVersion`; Lab 4 UI always supplies it.
3. CSRF rejection is explicitly planned for Action writes.
4. Idempotency-key required/invalid/boundary behavior has executable planned assertions.
5. Action create/PATCH text limits have planned boundary coverage.
6. Invalid Action pagination is covered.
7. Invalid Requester Dashboard and Staff Queue extension filters are covered.
8. Status-history UI pagination is fixed at page size 10 with Previous/Next, page indicators,
   boundary behavior, and a 21-row multi-page fixture.
9. FR-02 now explicitly says the initial Action status is server-set `PENDING`.
10. BR-25 now specifically requires `Idempotency-Key`.
11. AC-01 through AC-27 all have planned test mappings.
12. All 41 Lab 4 test rows remain `Planned`.
13. The PR remains documentation/governance only; no feature code, migration, or passing Lab 4
    executable result is claimed.

---

## Final requested changes before approval

1. Fix the contradictory Action-read authorization sentence in `api-spec.md §1`.
2. Reconcile `reviewer.md` with the already-updated live PR body.
3. Tighten the global integer wording so it does not imply that `0` is valid for positive-only
   fields.

After those small reconciliations, I would expect this Sprint 4 contract to be ready for final
approval re-review.
````

#### Conversation comment by @kittipichcha

Source: [Conversation comment 5924538599](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#issuecomment-5924538599) · 2026-10-01T04:07:54Z

```text
@oangsa, the response to review #5374801503 is pushed at `b6938dd1a032bbecc6ff7647562b69b63dcbb3f8`. I clarified the global Action-read authorization and integer conventions, reconciled the reviewer record with the live PR body, and left the 41-row Test DD unchanged (`Planned`). The change is documentation-only; no runtime, schema, migration, or executable-test implementation changed. `git diff --check` and the focused cross-layer audit pass. Please re-review this head when available. No approval is claimed; the current record remains five Changes Requested reviews.
```

#### Conversation comment by @kittipichcha

Source: [Conversation comment 5926542397](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#issuecomment-5926542397) · 2026-10-01T07:12:30Z

```text
@oangsa, the remaining governance question is isolated from the contract findings. Please leave a short durable PR comment confirming one of the following:

> I approve including the Lab 4 `agent.md` workflow changes in Issue #50 / PR #58.

This confirmation is only for the governance-isolation exception; it is not approval of the entire PR. Once the comment exists, I will record its exact URL in Issue #50, `docs/lab-04/specification.md`, `docs/lab-04/reviewer.md`, and the PR status text. No acceptance or review ID is being inferred until you make that decision.
```

#### Review by @oangsa — APPROVED

Source: [Review 5377076542](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/58#pullrequestreview-5377076542) · 2026-10-01T08:53:59Z · reviewed commit `f6a3538d9a5c5838259302a7c6619616e8e69d14`

```text
# PR #58 Approval Review

## Verdict

**Approved**

### Follow-up note (non-blocking)

- Please record the temporal Action-assignee eligibility-loss behavior in `specification.md §11 Assumptions and Decisions` so the choice remains auditable in the frozen contract.
- Keep the `agent.md` governance-scope acceptance clearly distinguished from formal PR approval in the final reviewer evidence.

The prior contract findings are resolved, `AC-01` through `AC-27` remain traceable to planned tests, all 41 Lab 4 Test DD rows remain `Planned`, and this PR remains documentation/governance-only with no runtime implementation or migration changes.
```

### PR #59 — feat(lab4-actions): implement Actions Taken foundation

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59)

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5387674883](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59#pullrequestreview-5387674883) · 2026-10-02T02:17:04Z · reviewed commit `edd9e22c61c7375ca6cc460d6ee8a88bb3e9b35d`

````text
## Verdict

**Fix then ship**

The overall design is appropriate. The Actions implementation is kept in dedicated controller/service/validation/idempotency modules while reusing existing Lab 3 authentication, CSRF, authorization, error handling, Prisma, and ownership infrastructure.

I found **one blocker and two major evidence/contract issues**.

---

## 1. Blocker — idempotent replay stops working after the Ticket becomes terminal

### Finding

An unexpired retry with the same `Idempotency-Key` and canonical request can return `409 CONFLICT` instead of replaying the original `201` if the Ticket becomes `RESOLVED`, `CLOSED`, or `CANCELLED` after the first successful Action creation.

### Evidence

In `server/src/action-service.ts`, `createAction()` currently performs the terminal-Ticket check before reading the existing idempotency record:

```ts
const ticket = await lockTicket(tx, ticketNumber);

if ((TERMINAL_TICKET_STATUSES as readonly string[]).includes(ticket.currentStatus)) {
  throw new ConflictError(
    "A Pending Action cannot be created on a resolved, closed, or cancelled Ticket.",
  );
}

// Idempotency lookup happens only after this.
const existing = await tx.actionCreateIdempotency.findUnique(...)
```

The frozen API contract says:

> Repeating the same key and hash before expiry returns the original `201` response and creates no row.

It separately says that **at or after expiry** the backend validates the current Ticket/request normally before creating a fresh Action.

### Why it matters

A valid sequence is:

```text
1. POST Action with key K
   -> 201 Action A

2. Ticket later becomes RESOLVED

3. Network/client retries the original request with key K before expiry
```

The frozen idempotency contract requires step 3 to return the stored original `201` for Action A.

The current path instead reaches the terminal-Ticket check first and returns `409`.

That means an already successful logical operation stops being replayable because unrelated state changed afterward.

### Suggested change

After resolving/locking the Ticket, process a **non-expired existing idempotency record before current Ticket-state validation**:

```text
lock Ticket
    ↓
lookup actor + concrete route + key
    ↓
unexpired record?
    ├─ same hash -> replay stored 201
    └─ different hash -> 409
    ↓
no record / expired record
    ↓
validate current Ticket + assignee + request
    ↓
create fresh Action + idempotency record atomically
```

Add a regression test:

```text
create Action
→ change Ticket to terminal
→ retry same key/body before expiry
→ 201 identical response
→ same Action ID
→ still exactly one Action
```

---

## 2. Major — the seed does not actually contain a "many Actions" Ticket

### Finding

`DB-SEED-01` is marked `Passed`, and BR-23 requires seed coverage for **zero / one / many Actions**, but the current seed puts exactly one Action on each of three different Tickets.

### Evidence

`server/prisma/seed.ts` defines:

```ts
const actionFixtures = [
  { ticket: createdTickets[0], ... },
  { ticket: createdTickets[1], ... },
  { ticket: createdTickets[2], ... },
];
```

So the resulting distribution is:

```text
Ticket 0 -> 1 Action
Ticket 1 -> 1 Action
Ticket 2 -> 1 Action
other Tickets -> 0 Actions
```

There is no Ticket with `2+` Actions.

The contract requires:

```md
BR-23: Seed data is idempotent and includes assigned/unassigned Tickets,
varied status/priority, zero/one/many Actions, and both nonzero and zero
dashboard examples.
```

The current test only checks the global Action count:

```ts
expect(firstActions).toHaveLength(3);
```

It never verifies Actions grouped by Ticket.

### Why it matters

Three one-Action Tickets do not exercise the multi-Action collection case required by the contract.

This will matter for downstream:

- Action pagination/list behavior
- Ticket Detail with multiple Actions
- dashboard counts
- resolution workflow fixtures
- one-Ticket/multiple-Action E2E scenarios

### Suggested change

Seed an explicit distribution such as:

```text
Ticket A -> 0 Actions
Ticket B -> 1 Action
Ticket C -> 2 or 3 Actions
```

Then make `DB-SEED-01` verify the distribution explicitly, for example:

```ts
expect(actionCountsByTicket).toContain(0);
expect(actionCountsByTicket).toContain(1);
expect(actionCountsByTicket.some((count) => count >= 2)).toBe(true);
```

---

## 3. Major — several Test DD rows are marked `Passed` without executing their complete frozen assertions

### Finding

The PR changes several Test DD rows from `Planned` to `Passed`, but the executable tests do not yet cover every assertion written in those rows.

The clearest examples are `API-ACT-02`, `SEC-ACT-02`, and `DB-SEED-01`.

### 3.1 `API-ACT-02` is only partially covered

The Test DD row requires:

```text
- missing / malformed Idempotency-Key
- canonical-equivalent replay
- changed-payload conflict
- exact expiry boundary
- fresh Action after expiry
- concurrent identical expired-key reuse creates exactly one Action
- failed expired-key operation leaves no replacement record or Action
- cleanup max 500 ordered by expiresAt,id
- unexpired records preserved
```

But `actions-taken.api.test.ts` currently simulates expiry using:

```ts
data: { expiresAt: new Date(Date.now() - 1000) }
```

That proves "already expired", not the frozen exact equality boundary `now >= expiresAt`.

It also does not exercise:

```text
concurrent expired-key reuse
failed expired-key replacement
```

The cleanup preservation assertion is currently:

```ts
expect(unexpired).toBeGreaterThanOrEqual(0);
```

That assertion is always true for a count and therefore does not prove that an intentionally inserted unexpired row survived cleanup.

### Suggested change

Add explicit cases for:

```text
now === expiresAt
concurrent expired reuse
failure during fresh expired-key operation
known unexpired row survives cleanup
```

### 3.2 `SEC-ACT-02` promises POST and PATCH CSRF coverage, but only POST is tested

The Test DD row says:

```text
Missing or invalid CSRF on Action POST/PATCH returns 403 FORBIDDEN before mutation
(no Action, idempotency row, Action revision, or version change).
```

The current test performs:

```text
POST without CSRF
POST with invalid CSRF
```

but does not perform a PATCH CSRF rejection.

### Suggested change

Create a real Action, record its version/revision count/current fields, attempt PATCH with missing/invalid CSRF, then assert:

```text
403
same Action version
same Action data
zero new revisions
```

### 3.3 `DB-SEED-01` cannot be `Passed` while the "many Actions" fixture is missing

Until the seed really contains zero/one/many Actions and the test proves it, `DB-SEED-01` does not satisfy its own frozen assertion.

Either finish the missing scenarios and keep these rows `Passed`, or temporarily mark incomplete rows `Implemented` / `Planned` according to the project's status rules.

---

## Verified behavior that currently holds

### Authentication / authorization

`server/src/module.ts` correctly applies:

```text
requireAuth
→ requirePasswordChanged
→ requireTicketReadAccess
```

for Action reads, and:

```text
requireAuth
→ requirePasswordChanged
→ requireCsrf
→ requireRole(["IT_STAFF", "ADMINISTRATOR"])
```

for Action writes.

Requester cross-owner Action reads remain ownership-safe `404`, and Requester writes are rejected by the backend.

### Requester projection

`action-service.ts` provides a separate Requester DTO and removes:

```text
performedBy.id
assignee.id
assignee.role
version
revision history
```

while retaining display names and current Action fields.

### Optimistic concurrency

PATCH follows:

```text
lock parent Ticket
→ load Action
→ verify PENDING
→ compare expectedVersion
→ validate combined state
→ update Action version + 1
→ append ActionTakenRevision
```

Concurrent same-version edits therefore serialize on the parent Ticket lock; one succeeds and the stale one conflicts.

### Migration

The migration is additive:

```text
+ Ticket.version
+ Ticket.resolvedAt
+ ActionTaken
+ ActionTakenRevision
+ TicketStatusChange
+ ActionCreateIdempotency
```

Legacy `resolvedAt` stays `NULL`, existing rows are preserved, required indexes are added, and no new Ticket index is introduced.

### Recovery

The migration tests exercise:

```text
Lab 3 populated DB
→ verified snapshot
→ migration
→ preservation checks
```

plus pre-write rollback/restoration and post-write forward recovery that preserves accepted Lab 4 state.

---

## Final requested changes

1. Move valid unexpired idempotency replay ahead of current terminal-Ticket validation.
2. Add a regression proving replay still succeeds after the Ticket later becomes terminal.
3. Change the seed so one Ticket has multiple Actions while preserving zero- and one-Action cases.
4. Strengthen `DB-SEED-01` to assert per-Ticket Action counts.
5. Finish the missing `API-ACT-02` expiry/concurrency/failure/cleanup assertions.
6. Add PATCH CSRF coverage for `SEC-ACT-02`.
7. Reconcile `tests.md` `Passed` statuses with the complete executable evidence after those tests exist.

## Final Verdict

**Fix then ship.**

The largest functional issue is the idempotency ordering bug because a legitimate retry can change from the frozen replayed `201` into a `409` merely because the Ticket state changed after the original successful request.
````

#### Review by @oangsa — APPROVED

Source: [Review 5392719697](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/59#pullrequestreview-5392719697) · 2026-10-02T14:02:37Z · reviewed commit `debea489a9e8936ac9fc9de5ab8de5311ac5ff16`

````text
## Verdict

**Approved**

The implementation blockers from the earlier review are resolved.

The current PR now correctly provides the Lab 4 Actions Taken backend foundation, including:

- Action persistence and immutable revision history;
- authenticated Staff/Admin writes and ownership-scoped Requester reads;
- server-derived performer identity and timestamps;
- assignee eligibility validation;
- Pending-only edits and terminal Action behavior;
- optimistic concurrency through `expectedVersion`;
- authoritative idempotent replay before current Ticket-state validation;
- expired-key revalidation and concurrent retry protection;
- bounded idempotency cleanup;
- additive migration and recovery coverage;
- idempotent zero/one/many Action seed fixtures;
- CSRF and authorization enforcement;
- migration, seed, API, and regression evidence.

The previous idempotency blocker is specifically resolved: an unexpired same-key/same-request retry now replays the original `201` result even if the parent Ticket becomes terminal afterward, while expired retries correctly revalidate current Ticket state.

The seed also now contains and verifies zero-, one-, and multiple-Action Ticket cases.

## Validation Reviewed

Repository-recorded verification was run on implementation head:

`3997f4e036a9265ed4c01d6264fee97d4d43a414`

with:

- Actions API/security/concurrency: **23 passed**
- Actions seed tests: **2 passed**
- Lab 4 migration/recovery: **3 passed**
- Lab 3 migration / historical fixture verification: **26 passed**
- Full server regression: **42 files / 633 tests passed / 0 failed**
- Prisma validation: **passed**
- Server build: **passed**

The current PR head is one documentation/evidence-only commit ahead of that verified implementation head; no production source, Prisma schema/migration, seed implementation, or executable test changed afterward.

## Follow-Up Notes — Non-Blocking

### 1. Dashboard boundary seed fixtures

The issue wording mentions dashboard boundary data. The current seed covers the important structural Action cases, but deterministic seven-day boundary timestamps can be made more explicit when the downstream dashboard work consumes them.

Examples include:

```text
Ticket.updatedAt == windowStart
Ticket.resolvedAt == windowStart
Action.createdAt == windowStart
```

and corresponding just-outside-the-window fixtures.

This is documentation/fixture completeness and does not block the Actions backend foundation.

### 2. Shared Test DD ownership

`API-ACT-08` and `SEC-ACT-02` remain `Planned` as complete Test DD rows because portions of those rows belong to downstream Ticket-workflow/dashboard issues.

PR #59 already executes and records the Action-specific clauses owned by this backend foundation.

For future audit clarity, the issue/test ownership wording can be refined so partial ownership of these shared rows is explicit.

## Final Assessment

The Action persistence/API foundation is ready to merge.

The previous functional findings are resolved, the implementation follows the frozen Lab 4 contract for this issue's backend scope, evidence is consistent with the current implementation state, and remaining concerns are non-blocking documentation/fixture follow-ups.

**Approved with follow-up notes.**
````

**Partner’s posted reply:** No partner conversation comment or inline reply was recorded on this PR.

### PR #60 — feat(lab4-actions): implement Actions Taken Ticket Detail UI - #52

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60)

#### Conversation comment by @kittipichcha

Source: [Conversation comment 5968450545](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#issuecomment-5968450545) · 2026-10-03T10:50:48Z

```text
Review-fix pass complete (plan items B1 closed, B2, B3, N1, N2; N3 deferred as agreed).

**Two commits pushed:**
- `39b4d058b9196eb49f054bce72b2fdb0c91250af` — `fix(lab4-actions): harden refresh and assignee recovery - #52` (tested implementation SHA; `client/src/ActionsTaken.tsx`, `client/src/ActionForm.tsx`, `client/src/lab-04-tests/ActionsTaken.test.tsx` only)
- `31c77b076843d102f61d5925b0cc73591041eef1` — `docs(lab4-actions): reconcile Issue 52 review-fix evidence - #52` (evidence/docs/restored screenshots only)

**Verification on the implementation SHA:**
- `UI-ACT-01` focused matrix **50 passed** (47 → 50), full client **19 files / 302 passed**, `npm run build` passed
- Server dependency gate: `prisma validate` / `migrate status` (8 migrations, up to date) / seed; Actions API 23, seed 2, Lab 4 migration 3; full `npm test` **42 files / 633 passed (exit 0)**
- Playwright: Actions flow **9/9**, responsive + keyboard **15/15** (desktop/tablet/mobile), affected Lab 3 regression **2/2**
- `git diff --check` clean; 0 `server/` files and 0 `artifacts/lab-03/**` files in `lab4-staging...HEAD`; the four historical Lab 3 screenshots are blob-equal to `lab4-staging` (zero-diff check exit 0)

The PR body has been reconciled to this run (stale 41/293/6 figures and the baseline wording replaced). Requesting **human re-review** — the earlier PR #59 approval does not cover PR #60.
```

#### Review by @oangsa — CHANGES_REQUESTED

Source: [Review 5400567676](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5400567676) · 2026-10-03T11:41:53Z · reviewed commit `31c77b076843d102f61d5925b0cc73591041eef1`

````text
# PR #60 Scrutinize Review — Lab 4 Actions Taken Ticket Detail UI

**Repository:** `kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter`  
**PR:** `#60`  
**Current head reviewed:** `31c77b076843d102f61d5925b0cc73591041eef1`  
**Tested implementation SHA:** `39b4d058b9196eb49f054bce72b2fdb0c91250af`  
**Base:** `lab4-staging` at `6b8937db0c8d8eefd16da74cb18369c9d6487c83`

## Verdict

**Fix then ship.**

The overall architecture is appropriate: Staff/Admin and Requester Actions surfaces are structurally separated, Action mutation behavior stays inside `ActionForm`, the existing Lab 3 transport/auth/backend contracts are reused, and this PR does not add another backend authorization layer or attachment-upload workflow.

I found **three contract/test gaps and one styling-contract violation**.

---

## Intent and simpler-alternative pass

The goal is to add the frozen Actions Taken experience to both Ticket Detail surfaces without expanding backend scope.

I do not see a smaller architecture that would materially reduce risk. The split between:

- `StaffActionsTaken`
- `RequesterActionsTaken`
- `ActionForm`
- the existing `api.ts` transport

is useful because the Requester surface cannot accidentally import or render mutation controls.

The problems below are implementation/evidence seams rather than a reason to redesign the feature.

---

## 1. Major — successful Action edits have no success state or accessible success announcement

### Finding

Create has a success state, but edit success immediately closes the form without rendering or announcing any success message.

This misses the supplied scope requirement to provide a **success state**, and the frozen UI contract's asynchronous-feedback expectations.

### Evidence

In `client/src/ActionForm.tsx:382-396`, the edit path does:

```ts
const updated = await updateTicketAction(ticketNumber, currentAction.id, payload);
setCurrentAction(updated);
setExpectedVersion(updated.version);
setConflict(null);
setSuccessNotice(null);
onSaved(updated);
onEditClosed?.();
```

`onEditClosed()` causes the parent to leave edit mode immediately.

There is no:

```text
role="status"
success-box
"Action updated"
```

or equivalent persistent announcement after that successful PATCH.

By contrast, the create path explicitly sets:

```ts
setSuccessNotice(
  `Action recorded by ${created.performedBy.name} at ${created.createdAt}.`,
);
```

The component test matrix also has no assertion for an edit-success announcement.

### Why it matters

For a sighted user, the card changing may be enough to infer success.

For keyboard/screen-reader users, however, the focused Save button disappears when the form unmounts and there is no live-region success feedback explaining what happened.

The supplied scope explicitly asks for loading, empty, **success**, validation, conflict, forbidden, not-found, and safe failure states.

### Suggested change

Keep a mutation-success notice at the `StaffActionsTaken` level so it survives the edit form closing.

For example:

```text
PATCH succeeds
→ update cached Action
→ close form
→ render role="status": "Action updated successfully."
→ refresh list
```

A refresh failure can then append the existing save-then-refresh warning without erasing the successful mutation notice.

Add a `UI-ACT-01` assertion that a successful edit produces an accessible success announcement after the form closes.

---

## 2. Major — create + refresh failure does not actually keep the committed Action value visible

### Finding

The PR and source comments claim that after a successful mutation followed by a failed list refresh, the committed value remains visible.

That is true for edits, but **not for newly created Actions**.

### Evidence

`client/src/ActionsTaken.tsx:282-298` says:

> the committed value stays on screen

but `handleSaved()` only updates an Action that is already present:

```ts
setItems((current) =>
  current.some((action) => action.id === saved.id)
    ? current.map((action) => (action.id === saved.id ? saved : action))
    : current,
);
```

For a newly created Action, `saved.id` is not in the current page, so cached `items` are unchanged.

Meanwhile, `client/src/ActionForm.tsx:367-381` clears the successful create draft immediately:

```ts
onSaved(created);

setDescription("");
setResult("");
setFollowUpRequired(false);
setFollowUpNote("");
setAttachmentNotes("");
setAssigneeUserId("");
```

If the subsequent `fetchStaffActions()` fails, the user therefore sees:

- the old cached Action list;
- a generic "saved but could not refresh" warning;
- an emptied create form;
- no card or read-only summary containing the Action that just committed.

The existing `UI-ACT-01` refresh-failure test checks the warning and that the mutation is not repeated, but it never asserts that `"New action text"` / `"Committed action"` remains visible after the refresh failure.

### Why it matters

There is no duplicate mutation, so data is safe, but the UI loses the only detailed representation of what the user just committed until Retry succeeds.

That contradicts this PR's own stated behavior and weakens the supplied requirement to retain useful state through recoverable failures.

### Suggested change

Do **not** optimistically insert the new Action into the paginated list if that would break stable paging.

Instead, keep a small transient committed-result snapshot outside the paginated list until the next successful refresh, for example:

```text
Action saved successfully

Description: ...
Status: Pending
Performed by: ...
Created: ...

The list could not be refreshed. [Retry]
```

Clear that snapshot once the refresh succeeds.

Then strengthen the refresh-failure test to assert the committed Action's meaningful values remain visible while Retry is offered.

---

## 3. Major evidence gap — the required performer / assignee / Ticket-owner distinction is not verified

### Finding

The supplied Issue #52 Tests section explicitly requires verification of:

> different performer/assignee/owner display

The current browser flow verifies only performer vs assignee.

It never gives the Ticket a distinct owner and never asserts the owner alongside those Action identities.

### Evidence

`e2e/lab-04/actions-taken-flow.spec.ts:131-139` says:

```ts
// Performer and assignee display names are both visible and distinct.
...
await expect(performer).toContainText(USERS.staff.name);
await expect(assignee).toContainText(USERS.adminPeer.name);
expect(USERS.staff.name).not.toBe(USERS.adminPeer.name);
```

There is no Ticket-owner assignment/assertion in this flow.

The existing staff Ticket detail renders the owner separately in
`client/src/StaffTicketDetail.tsx:489-494`:

```tsx
<span className="ticket-info-label">Owner</span>
<span className="ticket-info-value">
  {detail.ticketOwnerId === null ? "Unassigned" : `User #${detail.ticketOwnerId}`}
</span>
```

but PR #60's new evidence never demonstrates a three-way case where:

```text
Ticket Owner != Action Performer != Action Assignee
```

### Why it matters

One of the main Action-domain distinctions is precisely that these identities are independent.

The current E2E proves two of the three, leaving the supplied verification requirement incomplete.

### Suggested change

In the Actions browser flow:

1. assign/claim the Ticket to a known owner;
2. create the Action as a different Staff user;
3. assign the Action to a third eligible Staff/Admin user;
4. assert all three are displayed in their correct locations and remain distinct.

The full `E2E-01` row can remain `Planned` because Issue #53 owns the resolution half; this is only the Actions-owned evidence requested by Issue #52.

---

## 4. Minor — the new Actions styles add ad-hoc colors despite the frozen Zen Green rule

### Finding

The frozen UI contract says:

> Retain Lab 3 Zen Green tokens ... Do not add ad-hoc colors.

PR #60 adds a raw warning background literal twice.

### Evidence

`client/src/App.css:437-458` adds:

```css
.action-reopen-guidance {
  ...
  background: #fff8e6;
}

.conflict-box {
  ...
  background: #fff8e6;
}
```

The rest of the new Actions styles mostly use the existing variables correctly:

```css
var(--color-warning)
var(--color-pale-green)
var(--color-surface)
var(--color-field-readonly-bg)
```

### Why it matters

This is small visually, but it is a direct frozen-contract mismatch and creates another untracked design value.

### Suggested change

Use an approved existing token/background combination, or define an approved warning-background token in the design system before consuming it.

Do not leave `#fff8e6` inline in feature-specific rules.

---

## End-to-end behavior I traced and confirmed

### Staff/Admin routing

`App.tsx` routes both `IT_STAFF` and `ADMINISTRATOR` through the same `StaffTicketDetail` surface.

`StaffTicketDetail` renders:

```text
Ticket controls
→ StaffActionsTaken
→ Public Comments
→ Internal Notes
→ Attachments
```

so the Actions area does not replace prior Lab 3 functionality.

### Requester privacy boundary

Requester Ticket Detail imports only `RequesterActionsTaken`.

That component:

- calls the restricted Action read API;
- renders current Action text/status;
- renders performer and assignee **names only**;
- has no Action form import;
- renders no create/edit/view mutation buttons;
- renders no version/revision/audit fields.

The component tests additionally inject extra staff-only fields into a fake Requester object and confirm they are not rendered.

### Pagination

Both role surfaces use fixed `pageSize=10`.

The code provides:

- `Page X of Y` for nonempty pages;
- Previous/Next only when more than one page exists;
- disabled boundaries;
- no page-size selector;
- stale-response generation guards;
- page-1 fallback when the current page becomes invalid.

The 21-item / three-page component cases exercise the complete traversal.

### Create retry / duplicate protection

`ActionForm` normalizes the logical create payload before fingerprinting it.

The create path:

```text
first logical submit
→ crypto UUID key
→ failure keeps key and draft
→ unchanged retry reuses key
→ changed normalized payload rotates key
→ confirmed 201 clears key
```

A synchronous `inFlightRef` plus disabled Save control prevents repeated-click duplicate POSTs.

### Edit concurrency

Every PATCH carries `expectedVersion`.

A `409`:

- is never automatically retried;
- retains dirty draft fields;
- requires explicit "Review latest Action";
- fetches current Action state;
- reconciles untouched fields from the server;
- keeps user-modified fields;
- refreshes assignee eligibility;
- advances `expectedVersion` only after explicit review.

### Assignee eligibility

The form retains the current assignee's identity even when owner lookup fails.

A successful eligible-owner reload is the only thing that proves an assignee is ineligible.

After mid-session deactivation and a backend `409`, explicit conflict review refreshes eligibility and blocks resubmission until reassignment/unassignment.

### Terminal behavior

Completed/Cancelled Actions open a real read-only View surface with no Save/status/assignee controls.

Resolved/Closed/Cancelled Tickets hide Add Action and show reopen guidance, while an already-Pending Action can still be edited according to the frozen backend contract.

### Accessibility / responsive contribution

The Actions-specific Playwright coverage exercises:

- keyboard traversal;
- associated labels;
- visible focus;
- `aria-describedby` validation errors;
- conditional Follow-up Note;
- status radio group keyboard behavior;
- desktop/tablet/mobile viewport overflow checks.

The integrated `A11Y-01` / `VISUAL-01` rows correctly remain `Planned` for final Lab 4 integration.

---

## Evidence reconciliation

The implementation verification was run on:

`39b4d058b9196eb49f054bce72b2fdb0c91250af`

with repository-recorded results:

```text
UI-ACT-01 focused:             50 passed
Full client:                   19 files / 302 passed / 0 failed
Client build:                  passed

Actions backend dependency:    23 passed
Seed dependency:               2 passed
Lab 4 migration dependency:    3 passed
Full server:                   42 files / 633 passed / 0 failed

Actions Playwright flow:       9 passed
Responsive + keyboard:         15 passed
Affected Lab 3 browser checks: 2 passed
```

The final head:

`31c77b076843d102f61d5925b0cc73591041eef1`

is one commit ahead of the tested implementation SHA and changes documentation/evidence/screenshots only, not production or executable test code.

GitHub currently exposes no commit-status checks on the PR head, so these are repository-recorded local results rather than independently reproduced GitHub CI.

---

## Requested changes before approval

1. Add an accessible persistent success state for successful Action edits.
2. Preserve a visible representation of a newly committed Action when the post-create list refresh fails.
3. Add the missing three-way Ticket Owner / performer / assignee evidence required by Issue #52.
4. Remove the two feature-local `#fff8e6` literals and use the frozen design tokens.

## Final Verdict

**Fix then ship.**

The role/privacy, pagination, concurrency, assignee-recovery, and duplicate-submit paths are solid. The remaining issues are at the UI feedback/evidence seams: edit success is silent, a successful create disappears from view when refresh fails, the required owner/performer/assignee distinction is not actually tested, and two raw colors violate the frozen token rule.

````

#### Conversation comment by @kittipichcha

Source: [Conversation comment 5981302647](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#issuecomment-5981302647) · 2026-10-04T14:56:20Z

```text
Hi @oangsa — the four findings from your review [#5400567676](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5400567676) (submitted against `31c77b0`) are implemented and verified at tested implementation SHA `1bdaf8b`.

**Final candidate head for re-review: `210cd6835de428e4c6ea6900ef69ae457f65ab43`** (`docs(lab4-actions): reconcile PR 60 final evidence - #52`)

- Section-owned edit success announcement that survives the form closing
- Committed snapshot recorded before the follow-up refresh (survives a failed GET; Retry re-reads only)
- Owner / performer / assignee three-way identity asserted pairwise distinct in the Actions E2E
- All three `#fff8e6` literals replaced with `var(--color-field-readonly-bg)`

Every commit after `1bdaf8b` (`66414ee`, `0ffb67e`, `210cd68`) is documentation/evidence-only — no production or executable-test file changed, so no test rerun was required.

Evidence (on `1bdaf8b`): UI-ACT-01 **52 passed**, full client **19 files / 304 passed**, full server **633 passed**, Actions E2E **9 passed**, responsive+keyboard **15 passed**, affected Lab 3 regression **2 passed**.

The PR description and `artifacts/lab-04/issue-52/README.md` have been reconciled to this SHA chain. Requesting re-review on `210cd68` — no further branch commits are planned before your review. Refs #52
```

#### Review by @oangsa — APPROVED

Source: [Review 5407162076](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/60#pullrequestreview-5407162076) · 2026-10-04T16:29:29Z · reviewed commit `210cd6835de428e4c6ea6900ef69ae457f65ab43`

```text
LGTM!
```

### PR #61 — feat(lab4-workflow): implement Ticket Workflow and Resolution Gate - #53

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/61)

#### Review by @oangsa — APPROVED

Source: [Review 5427279665](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/61#pullrequestreview-5427279665) · 2026-10-06T10:53:09Z · reviewed commit `04223e069f956c746c14fad769d5ebe7e55b93a0`

````text
## Verdict

**Approved with follow-up note.**

## Follow-Up Note — Non-Blocking

The confirmation modal currently states the target status but not its **consequence**, while the frozen UI contract asks for both.

Example current wording:

```text
Change the status of TKT-... to Resolved?
```

Add short target-specific consequence text for `RESOLVED`, `CLOSED`, and `CANCELLED`.

This is a UX/document-contract issue only and does **not** block PR #61 or the next implementation.

````

**Partner’s posted reply:** No partner conversation comment or inline reply was recorded on this PR.

### PR #62 — feat(lab4-dashboards): implement role dashboards and exact drill-downs - #54

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62)

#### Review by @oangsa — APPROVED

Source: [Review 5443358420](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/62#pullrequestreview-5443358420) · 2026-10-07T13:53:31Z · reviewed commit `f83f51f45904daec56a871b41bd690b2536a3b9e`

````text
## Verdict

**Approved with follow-up note.**

## Follow-Up Note — Non-Blocking

Zero-value dashboard metric cards correctly show `0`, but the frozen UI contract also asks for concise empty copy.

For example, a zero status or priority card could also show:

```text
No matching Tickets
```

and the count-only Action metrics could show:

```text
No matching Actions
```

This is a UI-contract completeness issue only and does **not** block PR #62 or the next implementation.

````

**Partner’s posted reply:** No partner conversation comment or inline reply was recorded on this PR.

### PR #63 — test(lab4-release): verify integration and prepare release evidence - #55

[Pull request](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63)

#### Review by @oangsa — APPROVED

Source: [Review 5458574074](https://github.com/kittipichcha/TokTickIT-Full-Stack-Hello-World-Starter/pull/63#pullrequestreview-5458574074) · 2026-10-08T14:56:58Z · reviewed commit `ad09882afe57439c2d2b94e49a42912e088d7e01`

```text
## Verdict

**Approve PR #63 for the `lab4-staging` integration/evidence scope — not final release certification.**

The recorded verification supports the staging scope: 681 backend tests, 366 client tests, and 294 Playwright checks passed with no failures or skips. All 41 Test DD rows and 27 acceptance criteria are reconciled for staging. I found no merge-blocking implementation or evidence mismatch in the reviewed scope.

## Follow-Up Note — Required Before Final Release (Not Blocking This PR)

The following gates remain pending: human review of PR #63's current head, separately authorized staging-to-main merge and fresh main verification, actual Kanban/Project completion, author-confirmed reflection, and the final nine-part PDF/portal submission.

Keep Issue #55 and final release marked **Pending** until those events actually occur. Earlier feature-PR approvals and passing staging tests do not certify the final main branch or submission.

```

**Partner’s posted reply:** No partner conversation comment or inline reply was recorded on this PR.

## Historical local verification and release notes

The following existing record is preserved as a historical snapshot. Its pending-approval statements predate the reviews retrieved above: PR #84 now has an APPROVED review dated 2026-10-08, and PR #90 now has an APPROVED review and is merged into `lab4-staging`. These events do not establish a new staging-head test run or staging-to-main release acceptance.

# Lab 4 final release review — historical snapshot

Issue #83 local integration verification was executed on 2026-10-07. The
executor was Codex, acting for repository owner `oangsa`; this is not independent
peer review. Actual commands/results and AC reconciliation are in
[issue-83.md](evidence/issue-83.md). Final release acceptance remains pending.

## Available independent review evidence

GitHub metadata was read on 2026-10-07. All six dependency Issues are closed and
their feature PRs are merged into `lab4-staging`. Reviewer identity on the
following reviews is `kittipichcha`. An approval is attributed to its reviewed
revision; it is not silently extended to subsequent commits.

| Issue / PR | Review, response and disposition |
|---|---|
| #77 / [#84](https://github.com/oangsa/TokTickIT/pull/84) | [Changes requested](https://github.com/oangsa/TokTickIT/pull/84#pullrequestreview-5361269858) on `e268423b`: specify failed/interrupted migration recovery and include `isMigrated` in collection DTOs. Current contracts contain those corrections, but no later approval was found. The owner intends to correct the real PR review record. Approval remains pending; the instruction to “pretend it was approved” is not review evidence. |
| #78 / [#85](https://github.com/oangsa/TokTickIT/pull/85) | Reviews requested correction of contradictory frozen migration acceptance ownership. The owner-approved amendment assigns complete AC-34–35 / PG-02 / PG-13 / DATA-02 acceptance to #83 and retains #78 foundation evidence. [Approved](https://github.com/oangsa/TokTickIT/pull/85#pullrequestreview-5376698442), `db289c8f`, 2026-10-01. |
| #79 / [#86](https://github.com/oangsa/TokTickIT/pull/86) | Follow-up reconciled PG-10 ownership to #81, preserving #79 Action atomicity contributions. [Approved](https://github.com/oangsa/TokTickIT/pull/86#pullrequestreview-5381113563), `8a2f286e`, 2026-10-01. |
| #80 / [#87](https://github.com/oangsa/TokTickIT/pull/87) | [Approved with evidence caveat](https://github.com/oangsa/TokTickIT/pull/87#pullrequestreview-5389733591), `1ccd27d9`, 2026-10-02: independently reviewable browser/screenshots evidence requested. Follow-up publication is documented in issue-80.md; merged head `a2a7df7d` is later than the approved revision. #83 supplies current real-browser evidence, but no additional peer approval is invented. |
| #81 / [#88](https://github.com/oangsa/TokTickIT/pull/88) | [Approved](https://github.com/oangsa/TokTickIT/pull/88#pullrequestreview-5392749066), `18567066`, 2026-10-02. Owner-cleanup Activity/rollback and evidence follow-ups are documented below. Reviewer reported no blocker at the reviewed head; a low-priority control race remained backend protected. |
| #82 / [#89](https://github.com/oangsa/TokTickIT/pull/89) | [Approved with evidence attribution caveat](https://github.com/oangsa/TokTickIT/pull/89#pullrequestreview-5399665042), `3113f3b5`, 2026-10-03. Historical validation was attributed to an older revision. #83 reruns the integrated code locally; this is separate from the reviewer approval. |

## Final review and release gate

#83 is published in [PR #90](https://github.com/oangsa/TokTickIT/pull/90),
opened on 2026-10-07 against `lab4-staging`. Independent approval is pending. Its
required branch is `feature/83-lab4-final-verification-release`, based on staging
merge `1ee0b17`. The review scope is integration tests, dedicated performance and
security gates, committed visual evidence and release documentation; no product
endpoint, schema, role, permission or screen was added.

Publication requires the feature PR to `lab4-staging`, actual peer review,
resolution of the #77 approval record, and final staging-head verification.
Only then may the staging-to-main release PR be opened. The owner explicitly
authorized the feature-branch push and PR creation. Full final-head verification
is attributed to `1cce02a`; the publication-record follow-up changes documentation
only. No Issue closure, merge or release approval is claimed here.

Issue #80 feature validation is recorded separately in [issue-80.md](evidence/issue-80.md).

Issue #81 feature validation and #83 runtime-exclusion/E2E-01 handoff are recorded separately in [issue-81.md](evidence/issue-81.md). This is local feature evidence, not final-release peer review.

Issue #82 Dashboard implementation and local test/screenshot evidence are recorded in [issue-82.md](evidence/issue-82.md). That evidence records feature validation, not independent peer review or #83 release acceptance.

Issue #82 scrutiny follow-up fixes abandoned-flight round-trips and role-specific loading layout, with six failing-first UI regressions, 449 passing client tests, 18 passing mocked responsive cases and both builds. See the scrutiny-fixes section of [issue-82.md](evidence/issue-82.md); no PostgreSQL/real-API E2E rerun or final-release acceptance is claimed.

## PR #90 visual evidence follow-up — 2026-10-08

At reviewed head `74161965341cf2c182f1384c3a9cd6672a1087a9`, Codex inspected
all 69 committed screenshots individually and verified every manifest hash,
dimension and committed file byte. No confirmed visual blocker was found in
captured content. Coverage and viewport-only limitations are recorded in
[the visual inspection follow-up](evidence/issue-83.md#pr-90-visual-inspection-follow-up--2026-10-08).
This AI review evidence does not replace `kittipichcha`'s pending approval.
PR #84 reconciliation and integrated staging-head release gates remain pending.
