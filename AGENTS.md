## 1. Project constraints

This project has a fixed technology stack. Do not substitute frameworks,
libraries, databases, ORMs, or architectural styles unless the assignment
specification explicitly changes them.

### Required technology stack

| Area | Required choice |
|---|---|
| Frontend | React + TypeScript + Vite + Bootstrap |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Architecture | REST-style APIs |
| Testing | Vitest + Supertest |
| Workflow | Git, GitHub Projects, four Issues, `main`/`dev`/feature branches, Pull Requests, peer review |

Do not replace or introduce alternatives such as:

- Next.js
- Angular
- Vue
- Svelte
- NestJS
- Fastify
- Bun-specific frameworks
- Tailwind CSS
- Material UI
- Chakra UI
- MySQL
- SQLite
- MongoDB
- Supabase as a replacement database layer
- Drizzle
- Sequelize
- TypeORM
- another ORM
- GraphQL

Use **PostgreSQL through Prisma**.

Use **Express** for the backend.

Use **Bootstrap** for UI styling.

Use **REST-style APIs**.

### Lab scope restrictions

The following are introduced in later labs and must not be implemented unless
the current assignment explicitly requests them:

- Playwright
- authentication
- ticket creation
- image upload

Do not implement later-lab functionality early merely because it appears useful
or would make the application more complete.

---

## 2. Required repository structure

Preserve the required high-level repository structure:

```text
toktickit/
├── client/
├── server/
│   ├── prisma/
│   ├── src/
│   └── tests/
│       └── lab-01/
│       └── lab-XX/
├── docs/
│   └── lab-01/
│       ├── ai_use.md
│       └── reviewer.md
│   └── lab-XX/
│       ├── ai_use.md
│       └── reviewer.md
├── .gitignore
└── README.md
```

Do not move required directories or files without explicit approval.

### Directory ownership

#### `client/`

Contains the React + TypeScript + Vite frontend.

Frontend implementation, components, pages, hooks, API clients, styles, and
frontend-specific utilities belong here.

#### `server/src/`

Contains application backend code.

Express routes, controllers, services, middleware, validation, domain logic,
and supporting backend modules belong here.

#### `server/prisma/`

Contains Prisma configuration and database definitions, including the Prisma
schema and assignment-required migrations or seed logic when applicable.

Do not manually modify generated Prisma Client output.

#### `docs/lab-XX/`

Contains Lab XX documentation.

At minimum, preserve:

```text
docs/lab-XX/ai_use.md
docs/lab-XX/reviewer.md
```

Do not create alternative documentation hierarchies such as
`docs/contexts/` unless explicitly requested.

#### Repository root

Keep root-level files minimal.

`README.md`, `.gitignore`, and this `AGENTS.md` are valid root-level files.

Put assignment documentation in the required `docs/` location.

---

## 3. Before editing

Before making changes:

1. Read all applicable `AGENTS.md` files.
2. Check the current branch.
3. Run:

   ```bash
   git status --short
   ```

4. Identify pre-existing changes and preserve them.
5. Read the current lab specification and applicable documentation.
6. Read only files relevant to the requested feature.
7. Understand the affected frontend, backend, API, Prisma, and test paths before
   modifying them.
8. Define scope, acceptance criteria, required tests, risk, and commit
   instruction for substantial work.

For substantial work, internally establish:

```text
Feature:
Outcome:
Included:
Excluded:
Verified contracts:
Relevant files/modules:
Acceptance criteria:
Required tests:
Required documentation:
Risk: low | medium | high
Commit instruction:
```

Risk guidance:

- **Low** — localized, reversible, and isolated
- **Medium** — multi-file behavior, API changes, database interaction, or
  nontrivial integration
- **High** — authentication, authorization, privacy, schema migration,
  destructive database operations, concurrency, security-sensitive behavior,
  public API changes, or broad architecture

Even when the feature definition is not written into a file, use it to control
scope.

Never delete, reset, overwrite, reformat, stage, or commit unrelated changes.

### Prohibited Git commands without explicit approval

```bash
git reset --hard
git clean -fd
git checkout -- .
git restore .
git push --force
git push --force-with-lease
```

Never push unless explicitly requested.

Do not switch branches when doing so could overwrite or interfere with existing
work.

---

## 4. Requirements and scope

Use the assignment specification and repository contracts as the authority for
behavior.

Existing code may provide implementation patterns, but existing code is not
behavioral authority when it contradicts the current assignment.

Do not invent missing behavior based on:

- another lab
- another feature
- old code
- examples from another project
- previous prompts
- personal judgment
- assumed UX behavior
- "reasonable defaults"

When required behavior is missing, unclear, or contradictory:

1. Stop the affected portion of the work.
2. State the exact unresolved requirement.
3. Identify the affected files, API, UI, or data behavior.
4. Ask one concrete question.
5. Wait for the answer before implementing the dependent behavior.

Do not broaden the requested feature.

When unrelated work is discovered:

- report it if relevant
- leave it unchanged
- treat it as separate work

Do not mix feature implementation with unrelated:

- refactoring
- formatting
- dependency upgrades
- package replacement
- documentation cleanup
- architecture changes
- naming rewrites

Small refactoring directly required to implement the requested feature is
acceptable when it remains local and preserves behavior.

---

## 5. Architecture rules

The application uses a client/server architecture.

```text
React client
    |
    | HTTP / JSON
    v
Express REST API
    |
    v
Application logic
    |
    v
Prisma
    |
    v
PostgreSQL
```

Preserve this separation.

### Frontend responsibilities

The React application may:

- render UI
- collect user input
- perform client-side validation for user experience
- call REST endpoints
- display loading, success, empty, and error states
- manage presentation-level state

The frontend must not:

- connect directly to PostgreSQL
- use Prisma directly
- contain database credentials
- enforce business-critical validation only on the client
- duplicate authoritative backend business logic unnecessarily

### Backend responsibilities

The Express application is responsible for:

- API routing
- request validation
- business rules
- authoritative input validation
- database access
- HTTP status codes
- API error responses

Do not move required server-side rules into the frontend merely because the
frontend already validates them.

### Database responsibilities

Use Prisma as the database access layer.

Do not access PostgreSQL directly through another database library unless the
assignment explicitly requires it.

Do not introduce a second persistence abstraction.

---

## 6. TypeScript code style

Follow the nearest related code where it is consistent with these rules.

These rules take priority for new code.

### TypeScript

Use TypeScript for application source code.

Do not introduce JavaScript source files where TypeScript is appropriate.

Avoid `any`.

Prefer:

```ts
unknown
```

when the type is genuinely unknown, then narrow it safely.

Prefer explicit domain types and interfaces over arbitrary object shapes when
the data is shared across multiple functions or modules.

Bad:

```ts
const handleTicket = (ticket: any) => {
  return ticket.title;
};
```

Good:

```ts
interface Ticket {
  id: string;
  title: string;
}

const getTicketTitle = (ticket: Ticket): string => {
  return ticket.title;
};
```

### Naming

Use:

- `PascalCase` for React components, classes, interfaces, types, and enums
- `camelCase` for variables, functions, parameters, and object properties
- `UPPER_SNAKE_CASE` only for true constants when appropriate

Examples:

```ts
interface TicketResponse {
  id: string;
  title: string;
}

type TicketStatus = "open" | "closed";

const ticketId = "123";

function getTicketById() {
  // ...
}

function TicketCard() {
  // ...
}
```

Use descriptive names from the TokTickIT domain.

Avoid unexplained abbreviations.

Bad:

```ts
const usr = {};
const tkt = {};
const resData = {};
```

Prefer:

```ts
const user = {};
const ticket = {};
const ticketResponse = {};
```

### Functions

Prefer small functions with one clear responsibility.

Avoid functions with excessive branching or unrelated responsibilities.

Use `async`/`await` for asynchronous I/O.

Do not hide asynchronous work behind synchronous abstractions.

Bad:

```ts
promise.then((result) => {
  // ...
});
```

Prefer when readability improves:

```ts
const result = await promise;
```

Do not ignore rejected promises.

### Imports

Use consistent import ordering based on the nearest files.

Generally keep groups understandable:

```ts
import express from "express";

import { ticketRouter } from "./routes/ticketRouter";
import { errorHandler } from "./middleware/errorHandler";
```

Remove unused imports.

Do not add aliases or path mapping merely for aesthetic reasons.

### Formatting

Follow the repository formatter or existing conventions.

Do not reformat an entire unrelated file while changing a small section.

Do not manually fight formatter output.

---

## 7. React frontend rules

Use React with TypeScript and Vite.

Do not replace Vite or introduce another frontend framework.

### Components

Use function components.

Prefer:

```tsx
interface TicketCardProps {
  title: string;
  description: string;
}

export function TicketCard({
  title,
  description,
}: TicketCardProps) {
  return (
    <article>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}
```

Avoid oversized components containing unrelated application concerns.

Extract components when doing so improves readability or reuse, but do not
create abstractions for trivial one-use markup without benefit.

### React state

Keep state as local as reasonably possible.

Do not introduce:

- Redux
- Zustand
- MobX
- another global state library

unless explicitly required.

Use React's built-in mechanisms when they satisfy the requirement.

### Effects

Use `useEffect` only for synchronization with systems outside React or effects
that genuinely require it.

Do not use effects unnecessarily to derive values that can be computed directly
during rendering.

### API access

Centralize repeated API request behavior when practical.

Do not scatter hard-coded server URLs throughout components.

Prefer environment-based configuration supported by Vite when a configurable
base URL is required.

Frontend environment variables exposed through Vite must not contain secrets.

### Bootstrap

Use Bootstrap as the UI library required by the assignment.

Reuse Bootstrap classes and components before writing substantial custom CSS.

Do not add another UI framework.

Custom CSS is acceptable where Bootstrap cannot reasonably express the desired
layout or appearance.

Do not add Tailwind CSS.

---

## 8. Express backend rules

Use Node.js + Express + TypeScript.

Keep HTTP transport concerns separate from database details when practical.

A typical flow should remain understandable:

```text
route
  -> controller/handler
  -> service/domain logic
  -> Prisma
```

Do not create unnecessary layers for trivial functionality, but avoid putting
the entire application inside route callbacks.

### Routes

REST routes should represent resources and use HTTP methods appropriately.

Prefer patterns such as:

```text
GET    /api/tickets
GET    /api/tickets/:id
POST   /api/tickets
PUT    /api/tickets/:id
DELETE /api/tickets/:id
```

only when those operations are actually required by the current lab.

Do not implement routes for later-lab features prematurely.

### Controllers and handlers

Controllers should primarily handle:

- request extraction
- request validation coordination
- calling application logic
- translating results to HTTP responses

Avoid embedding large Prisma queries or complex business logic directly in
route definitions.

### HTTP responses

Use appropriate HTTP status codes.

Typical examples:

```text
200 OK
201 Created
204 No Content
400 Bad Request
404 Not Found
409 Conflict
500 Internal Server Error
```

Do not return `200` for every outcome.

Do not expose stack traces or internal database details to clients.

Keep error responses consistent within the repository.

### Validation

Validate all externally supplied data on the server.

Examples include:

- path parameters
- query parameters
- request body fields

Frontend validation does not replace backend validation.

Do not trust client-generated identifiers or values merely because the UI
normally produces valid data.

Do not add a new validation library unless already approved by the project or
explicitly required.

---

## 9. Prisma and PostgreSQL rules

PostgreSQL is the required database.

Prisma is the required ORM.

### Prisma schema

Treat:

```text
server/prisma/schema.prisma
```

as the authoritative Prisma data-model definition when that path is used by the
repository.

Before changing the schema:

1. inspect existing models
2. inspect relationships
3. inspect existing migrations if present
4. inspect affected API code
5. determine whether the requested lab actually permits a schema change

Do not invent fields or relationships without specification support.

### Database access

Use Prisma Client.

Prefer focused queries that retrieve only data required by the feature.

Avoid unnecessary repeated database queries.

Do not introduce raw SQL when Prisma can correctly express the required
operation.

If raw SQL is genuinely required:

- explain why
- parameterize values
- never concatenate untrusted input into SQL

### Generated Prisma code

Never manually modify generated Prisma Client files.

Modify source definitions and regenerate.

For generated code:

1. modify `schema.prisma` or another source definition
2. run the appropriate Prisma generator
3. review generated effects
4. ensure source and generated output remain synchronized

### Migrations

Do not:

- rewrite existing applied migrations
- delete migrations merely to repair local state
- perform destructive schema changes without approval
- reset the database without explicit authorization

If a destructive migration appears necessary, stop and report the consequences
before proceeding.

Do not run commands such as:

```bash
prisma migrate reset
```

against an existing database unless explicitly approved.

Never assume data may be discarded.

---

## 10. REST API contracts

Treat the API contract as shared behavior between `client/` and `server/`.

When changing an API:

1. inspect the backend route
2. inspect request validation
3. inspect response mapping
4. inspect frontend consumers
5. inspect affected tests
6. update all applicable layers together

Do not silently change:

- route paths
- HTTP methods
- status codes
- request field names
- response field names
- identifier formats
- required/optional fields

unless the requested feature requires the change.

Avoid exposing raw Prisma records if the API requires a different public shape.

Use clear response types where helpful.

---

## 11. Implementation and testing

Implementation must:

- stay within approved scope
- preserve unrelated changes
- preserve established public contracts
- avoid broad refactoring
- validate authoritative behavior server-side
- prevent silent data loss
- update applicable tests
- update required Lab XX documentation
- never expose secrets or production data

Complete every applicable layer.

For a feature spanning the application, inspect and modify as necessary:

```text
client UI
REST request
Express route
controller/handler
business logic
Prisma persistence
response mapping
client response handling
tests
documentation
```

Do not claim a feature is complete when only one required layer has been
implemented.

### Testing expectations

Every behavior change should have appropriate automated validation when the
repository supports it.

Use:

- unit tests for isolated logic
- Supertest API tests for Express endpoints
- database-related tests when persistence behavior must be verified
- focused integration tests for complete backend flows

Do not:

- delete valid failing tests
- weaken assertions solely to obtain a pass
- skip failing tests without explanation
- mock away the behavior being tested
- call production services from automated tests
- use real credentials
- claim tests passed when they were not run

After fixing a defect:

1. add or update a regression test when appropriate
2. rerun the originally failing test
3. rerun the affected test suite

Run focused tests first, then broader checks.

A successful TypeScript compilation alone is not sufficient evidence that a
behavior works.

### Expected validation

Use the commands defined by the repository's actual `package.json` files.

Do not assume script names without inspecting them.

At minimum, before completing substantial work, run applicable commands for:

```text
type checking
tests
frontend build
backend build/type check
```

If a required check cannot run, report:

- why it could not run
- what was validated instead
- the exact remaining command when known
- what remains unverified

---

## 12. Generated code and build output

Do not manually edit generated output.

Examples may include:

- Prisma Client output
- compiled JavaScript
- Vite build output
- generated coverage output

Modify source files instead.

Do not commit generated build directories such as `dist/` unless repository
requirements explicitly require them.

Generated code procedure:

1. modify source definitions
2. run the repository generator
3. inspect changes
4. commit generated files only when repository convention requires them
5. keep generated files synchronized with their sources

---

## 13. Documentation

Use the required documentation structure:

```text
docs/
└── lab-01/
    ├── ai_use.md
    └── reviewer.md
```

Do not create unrelated documentation structures merely to preserve agent
context.

### README

Keep setup instructions synchronized with actual repository behavior.

When setup changes, update `README.md` only when that change affects users or
assignment-required setup.

Do not perform unrelated README cleanup during feature work.

---

## 14. Secrets and privacy

Never commit or log:

- passwords
- API keys
- authorization headers
- session cookies
- access tokens
- refresh tokens
- private certificates
- production database URLs
- real credentials
- sensitive personal information

Use placeholders such as:

```text
<API_KEY>
<PASSWORD>
<DATABASE_URL>
<USERNAME>
<SESSION_COOKIE>
```

Environment files containing secrets must not be committed.

Before finalizing work, inspect changed and staged files for accidental secret
exposure.

Frontend code must never contain server secrets.

Values exposed using Vite client-side environment variables must be assumed
public.

Do not disable TLS certificate verification.

Do not introduce:

- analytics
- user tracking
- advertisements
- remote crash reporting
- cloud persistence

unless explicitly required.

---

## 15. Dependencies

Do not add dependencies merely for convenience.

Before installing a package:

1. verify existing dependencies cannot satisfy the requirement
2. verify the package is compatible with the required stack
3. confirm it does not substitute a required technology
4. ensure the feature genuinely requires it

Do not upgrade existing dependencies as unrelated work.

Do not change:

- React
- Vite
- Express
- TypeScript
- Prisma
- PostgreSQL tooling
- Vitest
- Supertest

versions unless required by the requested work or assignment.

Never replace Bootstrap with another UI framework.

Never replace Prisma with another ORM.

---

## 16. Git and branch discipline

The required workflow uses:

```text
main
dev
feature branches
Pull Requests
peer review
```

Respect the repository's existing branch strategy.

Do not directly merge into `main` or `dev` unless explicitly requested and
permitted by the assignment workflow.

For feature work, preserve branch scope.

Do not combine multiple unrelated Issues into one feature branch merely for
convenience.

### GitHub workflow

The assignment requires:

- Git
- GitHub Projects
- four Issues
- `main`
- `dev`
- feature branches
- Pull Requests
- peer review

Do not bypass these requirements by directly implementing everything on one
branch if the assignment expects separate feature work.

Do not create, close, edit, or reorganize GitHub Issues or Project items unless
requested.

---

## 17. Commit discipline

Commit only when explicitly permitted by the user or current task.

`Do not commit` always overrides any automatic commit behavior.

Allowed commit prefixes:

- `feat`
- `fix`
- `test`
- `docs`
- `style`
- `refactor`
- `chore`

Use:

```text
<type>: <concise outcome>
```

Examples:

```text
feat: add ticket listing endpoint
fix: validate invalid ticket identifiers
test: cover ticket listing responses
docs: update lab 01 AI usage
```

Before committing, run:

```bash
git status --short
git diff
git diff --staged
```

Confirm:

- only in-scope files are staged
- no secrets are staged
- pre-existing work remains intact
- required tests ran
- required documentation is current

Prefer explicit staging paths:

```bash
git add server/src/routes/tickets.ts
git add server/tests/lab-01/tickets.test.ts
```

Avoid:

```bash
git add .
```

unless every changed file has been inspected and confirmed in scope.

After committing, run:

```bash
git status --short
git log -1 --oneline
```

Report:

- commit hash
- commit message
- remaining uncommitted files and why they remain

Never push unless explicitly requested.

---

## 18. Scope-specific rules

1. **Do not change the required technology stack.**

   Use only:

   ```text
   React + TypeScript + Vite + Bootstrap
   Node.js + Express + TypeScript
   PostgreSQL + Prisma
   REST-style APIs
   Vitest + Supertest
   ```

2. **Do not implement later-lab functionality during Lab XX.**

   Unless explicitly required, do not add:

   ```text
   Playwright
   authentication
   ticket creation
   image upload
   ```

3. **Preserve the required repository structure.**

   Do not relocate `client/`, `server/`, `server/prisma/`,

4. **Change only files related to the requested Issue or feature.**

   Do not alter another feature's behavior without a verified dependency.

5. **Understand the complete affected path before editing.**

   For a backend API feature, inspect at least the relevant:

   ```text
   route
   handler/controller
   service or business logic
   Prisma model/query
   tests
   frontend consumer when applicable
   ```

6. **Reuse existing code before introducing abstractions.**

   Reuse existing:

   - components
   - API helpers
   - Express middleware
   - validators
   - services
   - Prisma models
   - error handling
   - TypeScript types

   when they correctly support the requested behavior.

7. **Do not invent API or domain details.**

   If the specification does not establish:

   - endpoint behavior
   - field mapping
   - response shape
   - validation rule
   - database relationship
   - error behavior

   and the repository cannot establish it, stop and ask.

8. **Validate server-side.**

   Never rely solely on client validation.

9. **Use Prisma only for persistence.**

   Do not add another ORM or generic persistence layer.

10. **Protect credentials and personal data.**

    Never include real credentials or sensitive data in tests, fixtures,
    screenshots, examples, responses, logs, or documentation.

11. **Keep REST integration maintainable.**

    Centralize repeated API base URLs and transport behavior instead of
    duplicating them across React components.

12. **Do not introduce later-lab architecture proactively.**

    Avoid designing authentication abstractions, upload infrastructure, or
    Playwright suites before they are required.

13. **Run relevant Lab XX tests before completion.**

    Use Vitest and Supertest according to repository scripts.

14. **Do not upgrade packages, change build tools, or change deployment settings
    unless required.**

15. **Keep project documentation inside the required `docs/` hierarchy.**

    Root-level `AGENTS.md` and `README.md` are explicit exceptions.

---

## 19. Incomplete work

Do not claim completion without evidence.

Do not commit incomplete work as though it were complete.

When blocked:

- stop safely
- explain the blocker
- identify affected behavior
- preserve unrelated work
- report partial changes accurately
- state what remains unverified
- provide the exact next action when known

Do not create a WIP commit unless explicitly requested.

Partial work may be committed only when:

- it is independently valid
- the user approves
- the commit message accurately describes the partial result

---

## 20. Completion gate

Before claiming completion:

1. Run:

   ```bash
   git status --short
   ```

2. Review:

   ```bash
   git diff --stat
   git diff --name-status
   ```

3. Review all relevant changed code.
4. Confirm every requested requirement has implementation evidence.
5. Confirm required tests actually ran.
6. Confirm required builds or type checks actually ran.
7. Confirm failures and limitations are reported.
8. Confirm no unrelated changes were introduced.
9. Confirm pre-existing changes remain intact.
10. Confirm required Lab XX documentation is current.
11. Confirm the required repository structure remains intact.
12. Confirm no prohibited later-lab feature was introduced.
13. Follow the explicit commit or non-commit instruction.

For database or other high-risk changes, directly verify:

- affected Prisma fields
- relationships
- data preservation
- destructive behavior
- transaction behavior when applicable
- REST contract impact

---

## 21. Final report

The final response for a code change must clearly distinguish completed,
partial, untested, blocked, unrelated, and future work.

Include:

- completed changes
- changed files or areas
- REST endpoints affected
- Prisma/database changes, if any
- tests executed and their results
- builds/type checks executed and their results
- Lab XX documentation changed
- review/audit result when applicable
- security/privacy findings
- known limitations or blockers
- commit hash and message, or why no commit was created
- current working-tree status

Never say:

```text
all tests pass
build succeeds
feature complete
fully working
```

unless those statements are supported by commands actually run during the
current work.

If something was not tested, say so explicitly.
