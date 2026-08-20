# Lab 2 — AI Use and Reflection  (fill this in)

**LLM/agent used:** Codex (GPT-5)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Draft `ai_use.md` and `reviewer.md` for Lab 2 using the Lab 1 format strictly. | Created the two Lab 2 documents with the Lab 1 headings and layout. I initially left placeholders because no Lab 2 AI-use or peer-review history was available. |
| 2 | Fill the Lab 2 AI-use record and add an AGENTS.md rule requiring every user prompt to be recorded there. | Replaced the placeholders with the available Lab 2 prompt history and added the documentation rule. |
| 3 | Scrutinize the Lab 2 changes against Issue #17. | Traced the four engineering-contract documents against the Issue, Lab 2 handout, and test matrix. Found that Issue-specific focused test assignments and close gates are missing. |
| 4 | Fix the review finding and ship it without bulk commits. | Added the per-Issue focused-test ownership and close gates, linked the workflow DoD to them, then prepared one explicitly scoped commit. |
| 5 | Review the Lab 2 contract for partial handout API examples and Pending Attachment preview coverage. | Added an explicit handout-example assumption to `specification.md` and tightened UI-27 in `tests.md` to require Pending and Active preview cases. |

## Reflection
The first draft preserved the Lab 1 format but did not contain enough evidence
to fill the record. The follow-up made the expected record-keeping explicit:
the AI-use document must be updated as Lab 2 work happens, rather than being
reconstructed at the end. This record currently contains the four Lab 2 prompts
available in this session; future prompts will be appended when their related
work is performed. The Issue #17 review also showed that a broad test matrix is
not a substitute for assigning focused tests and close gates to each
implementation Issue.
The latest review added an explicit rule that partial handout API examples are
not wire contracts and tightened the Pending-preview UI test requirement.
