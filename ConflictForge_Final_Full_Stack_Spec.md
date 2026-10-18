# ConflictForge — Unified Full-Stack Implementation Specification

**Audience:** Coding agent implementing ConflictForge  
**Backend stack:** JavaScript, Node.js, Express 5, MySQL, Prisma  
**Current authentication:** Google sign-in, JWT access token, HTTP-only refresh-token cookie, `User` and `RefreshToken` tables  
**Frontend:** Inspect the existing frontend repository; the current technical documentation describes React + Vite and Axios, so reuse those conventions if still accurate.  
**Core UI:** Monaco Diff Editor plus an AI explanation/chat panel.

This document combines the database, backend API, analysis pipeline, and frontend specifications and incorporates the current database/auth setup. Inspect the actual repository before editing. The document describes the target design, not features that are guaranteed to exist already.

---

# 1. ConflictForge overview

ConflictForge helps a developer understand conflicts in a GitHub pull request (PR). The user gives ConflictForge a repository URL, selects a PR, and views the relevant code changes, conflict findings, and an AI-generated explanation/recommendation.

## MVP user journey

1. User signs into ConflictForge with Google.
2. User enters a GitHub repository URL.
3. Backend checks that the repository exists and is readable.
4. User selects a pull request.
5. Backend obtains exact base/head commit SHAs and the changed-file list.
6. A merge-analysis component identifies actual Git merge conflicts using three-way merge behavior.
7. Diff and, where supported, AST analysis add useful context.
8. An LLM explains the evidence and suggests resolution strategies.
9. The backend persists the latest successful analysis and returns structured data.
10. The frontend displays file navigation, a Monaco diff view, findings, and contextual AI chat.

The MVP is an **analysis and explanation tool**. It must not automatically modify branches, push commits, merge PRs, or execute repository code.

## MVP boundaries

In scope:
- Repository URL submission and access checks.
- Listing PRs in the selected repository.
- Viewing PR details and analysis status.
- Actual merge-conflict detection.
- Relevant code/diff/AST context.
- LLM explanation and suggested resolution.
- Latest completed findings persisted in MySQL.
- Monaco-based read-only code comparison.
- Contextual AI chat, after a chat API contract is implemented.

Out of scope for this phase:
- Automatic merge or commits.
- Applying AI-generated fixes directly to GitHub.
- Executing untrusted repository code or test suites.
- Docker/VM resolution sandbox.
- Full analysis-history system.
- Repository synchronization for every repository in a user's GitHub account.
- Separate microservices for each backend component.

---

# 2. Existing backend and authentication — preserve this setup

The attached technical documentation describes a layered JavaScript backend with this structure:

```text
backend/
  prisma/
    schema.prisma
  src/
    config/
      env.js
      prisma.js
    controllers/
      auth.controller.js
    middlewares/
      error.middleware.js
      security.middleware.js
      verify.middleware.js
    repository/
      token.repository.js
      user.repository.js
    routes/
      auth.routes.js
    services/
      auth.service.js
    utils/
      errors.js
      serializers.js
      tokens.js
    server.js
  .env
  .env.example
  package.json
  package-lock.json
```

The documentation describes:
- `POST /api/auth/signin`: verifies the Google ID token, upserts the app user, and issues tokens.
- `POST /api/auth/refresh`: rotates the refresh token.
- `POST /api/auth/signout`: revokes the refresh-token record and clears the cookie.
- `GET /api/auth/me`: protected current-user endpoint.
- `verify.middleware.js`: verifies the bearer access JWT and sets `req.user`.
- `config/prisma.js`: shared/singleton Prisma Client.
- `error.middleware.js` and `utils/errors.js`: centralized error handling.
- `utils/serializers.js`: normalized/safe API serialization.
- `User` and `RefreshToken` tables already exist.

**Do not recreate, rename, or replace these tables or rewrite working auth code.** Inspect `schema.prisma`, `package.json`, the actual routes and middleware before making changes. Use the existing module style and shared Prisma Client.

## Current `User` table

The user's existing MySQL `user` table contains:

| Column | Meaning |
|---|---|
| `id` | ConflictForge user's internal ID |
| `email` | Google-authenticated email, unique |
| `name` | Optional display name |
| `avatarUrl` | Optional Google profile image |
| `googleId` | Unique Google identity ID |
| `createdAt`, `updatedAt` | Timestamps |

`RefreshToken` stores `id`, `tokenHash`, `userId`, `expiresAt`, and `createdAt`. Keep its relation to `User` unchanged.

When adding a repository relation, update the existing Prisma `User` model by adding the appropriate relation field; do not replace the existing fields. Match the exact type and database mapping of `User.id` (`VARCHAR(191)` in the current database) in any referencing `userId` field.

Google identity is the ConflictForge account identity. It is **not** GitHub repository authorization.

---

# 3. Repository access: Google sign-in versus GitHub permission

This distinction matters:

- **Google sign-in:** proves who is signed into ConflictForge.
- **GitHub repository access:** determines whether ConflictForge can read the URL the user submitted.

Do not check whether the GitHub repository's owner name matches the signed-in user's Google account. A developer can legitimately work on a teammate's or organization's repository. Instead, check whether the repository is public or whether ConflictForge has permission to read that specific repository.

### Public repository

A public repository can be read through GitHub's public endpoints, subject to API rate limits. Still validate the URL and confirm the repository exists.

### Private repository

A repository URL alone does **not** grant access. Google sign-in does not grant GitHub permissions. The user must grant GitHub access separately, preferably through a **GitHub App installed on the selected repository** with the minimum read permissions required for repository metadata, contents, and pull requests. The backend should obtain/use the appropriate short-lived installation access token.

If the application does not yet have that GitHub authorization flow, implement it as a clear prerequisite or report it as a blocker; do not pretend Google authentication is enough. Never ask users to paste long-lived tokens into normal request bodies, expose tokens to the browser, or log them.

### Scope of repository processing

ConflictForge only needs to process the repository URL the user provides and the PR they select. Do not enumerate, import, or sync all of their GitHub repositories unless that becomes a separately requested feature.

### Local application access still matters

There are two different checks:
1. **GitHub access check:** can the backend read the chosen upstream repo?
2. **ConflictForge data access check:** can the signed-in app user access the local repository/PR analysis record they are requesting?

You do not need to prove that the repo belongs to the Google user. But the backend should still scope local records to the user who submitted them (or use an explicit sharing model later) so someone cannot guess another user's local database ID to read private analysis results.

For the lean MVP, keep a `userId` on each `Repository` row as the ConflictForge user who added the URL. This field records who added it; it does not assert GitHub ownership.

---

# 4. Database model and design rationale

Keep the existing `User` and `RefreshToken` models and add four-way product data with these relationships:

```text
User 1 ───── * Repository 1 ───── * PullRequest 1 ───── * Conflict
```

`User` is already present. Add these three new product tables:
- `Repository`
- `PullRequest`
- `Conflict`

Do not add separate `Commit`, `AnalysisHistory`, `AnalysisJob`, `ConflictHistory`, or `Resolution` tables for this MVP.

## 4.1 Why do we need `githubRepoId` if `Repository.id` is already the primary key?

They identify different things:

- `Repository.id` identifies **our row in ConflictForge's MySQL database**. The frontend can use it in API routes.
- `githubRepoId` identifies **the upstream repository on GitHub**. It lets the backend recognize the same GitHub repository even if its owner/name or URL changes after a rename/transfer.

The internal ID does not tell the backend which GitHub repository the row refers to. `owner` and `name` are useful labels but can change.

For this MVP, because each app user may add the same upstream repo independently, use a compound uniqueness rule such as `(userId, githubRepoId)` rather than making `githubRepoId` globally unique while storing a single `userId` owner. This permits separate user-scoped records for the same public/shared repository. If the architecture later changes to one global repository record with many app-user memberships, redesign the relationship explicitly.

`githubRepoId` is useful but not strictly essential in a tiny prototype that never needs to reconcile a remote repo after rename/transfer. Keeping it is the more robust choice.

## 4.2 Repository model

Suggested fields:
- `id`: internal primary key.
- `userId`: ConflictForge user who added the URL.
- `githubRepoId`: remote GitHub repository ID.
- `owner`, `name`, `fullName`, `url`.
- `defaultBranch`, `isPrivate`.
- timestamps.
- relation to `PullRequest`.

Use a unique constraint on `(userId, githubRepoId)` and an index on `userId`. Store only the selected repository; do not sync the user's entire GitHub account.

## 4.3 PullRequest model

Suggested fields:
- `id`: internal primary key.
- `repositoryId`: foreign key.
- `githubPrNumber`: PR number on GitHub.
- `title`, optional `body`, `state`.
- `baseBranch`, `headBranch`.
- `baseSha`, `headSha`.
- `mergeable`.
- `analysisStatus`.
- optional `hasConflicts`.
- `analyzedBaseSha`, `analyzedHeadSha`.
- `analysisStartedAt`, `analysisCompletedAt`, `analysisError`.
- timestamps and relation to `Conflict`.

Use a unique constraint on `(repositoryId, githubPrNumber)`: PR numbers are unique within one repository, not globally.

### What are `baseSha` and `headSha`?

A branch name such as `main` or `feature/payment-retry` is a moving pointer. A SHA identifies one specific commit/version of the repository.

- `baseSha`: exact commit SHA for the PR's target/base branch at the time the metadata was fetched.
- `headSha`: exact commit SHA for the PR's source/head branch at the time the metadata was fetched.
- `analyzedBaseSha` and `analyzedHeadSha`: exact SHAs used by the most recent **successful** ConflictForge analysis.

These fields let the backend and frontend:
- retrieve the exact code that was analyzed;
- know whether a new commit or base-branch update made findings stale;
- avoid showing source from a newer branch state as if it belonged to an older analysis;
- keep line ranges and conflict results tied to the correct code versions;
- preserve the last successful result if a new analysis fails.

You could omit the `analyzed*Sha` fields in a very small demo and only use the current SHAs, but then it is much harder to tell whether saved findings are stale. For this product, keep them.

### Why store `analysisStatus`?

Without a status, an empty conflict table is ambiguous: perhaps no analysis has run, perhaps it is running, perhaps it failed, or perhaps it completed and found zero conflicts.

Use:
- `NOT_ANALYZED`
- `QUEUED` (only if queued work is actually supported)
- `RUNNING`
- `COMPLETED`
- `FAILED`

This supports frontend loading states, retry actions, and correct interpretation of an empty result. If a run fails but old findings are retained, the UI can say that the latest attempt failed and the displayed findings belong to the last successful SHAs.

### Why store `mergeable`?

This is GitHub's mergeability signal, separate from ConflictForge's own analysis. It can be `true`, `false`, or `null` while GitHub calculates it. It is useful metadata, but it is not the conflict report and does not locate the exact conflict lines. Treat `null` as unknown/pending, not as conflict-free.

### Why store `hasConflicts`?

This is ConflictForge's summary result after **its own analysis**. It can be `NULL` before the first successful analysis, `true` if the completed analysis has conflict findings, and `false` if the completed analysis found none.

It is convenient in a PR list without counting all conflict rows. It is denormalized, because it can be derived from current conflict rows after a successful analysis. To keep the MVP simpler, you may omit `hasConflicts` and derive it from `(analysisStatus === COMPLETED)` and the conflict count. If the field is kept, update it only as part of successful analysis persistence and never interpret `NULL` as `false`.

## 4.4 Conflict model

A `Conflict` row represents one finding from the latest successful analysis for a PR.

Suggested fields:
- `id`, `pullRequestId`.
- `filePath`.
- `conflictType`: `MERGE`, `SEMANTIC`, `UNKNOWN`.
- `risk`: `LOW`, `MEDIUM`, `HIGH`, `UNKNOWN`.
- `baseStartLine`, `baseEndLine`, `headStartLine`, `headEndLine`.
- `baseSha`, `headSha`, `ancestorSha`.
- `baseCode`, `headCode`, `ancestorCode`: **small relevant excerpts only**, if needed.
- `diff`: relevant diff/hunk, not necessarily a whole file.
- `astContext`: optional JSON structure.
- `commitContext`: optional JSON structure.
- `explanation`, `suggestedResolution`.
- timestamps.

Base and head line ranges can differ, so do not force them into one line range. The common ancestor SHA and code can help explain how the two branches diverged.

### Should Conflict rows store entire base, head, and ancestor files?

**No, not by default.** Storing every full file version on every conflict can create:
- large, duplicated MySQL rows when several findings occur in one file;
- increased storage, backup, and transfer cost;
- unnecessary retention of private repository source code;
- bigger database reads when the UI only needs conflict summaries;
- stale/unclear copies unless each payload is rigorously linked to exact SHAs.

Store concise relevant snippets, diff hunks, line ranges, and the SHAs that identify the exact versions. Limit excerpt length and do not store entire files in `Conflict`.

If the frontend needs to show a **full-file Monaco diff**, fetch the full file contents from the backend at the exact analyzed SHAs when requested (or use a short-lived cache later). Do not make the browser call private GitHub APIs directly and do not return GitHub access tokens to the browser. If only excerpts are available, label that UI as a conflict snippet/context view rather than pretending it is a complete file diff.

If you later decide to persist file snapshots, use a deliberate deduplicated cache/blob model keyed by repository + SHA + path and apply retention limits; do not duplicate full files in each Conflict row for the MVP.

## 4.5 Prisma integration rules

- Keep the current `User` and `RefreshToken` model definitions and relations.
- Add the relation field on the existing `User` model rather than replacing that model.
- New `Repository.userId` must use the same DB type and length as `User.id` (`VARCHAR(191)` in the observed table).
- Use the existing `DATABASE_URL` and shared Prisma Client in `src/config/prisma.js`.
- Use migrations in line with the installed Prisma version and current database. Inspect existing schema/migrations first; do not reset the database.
- GitHub repository IDs can be represented by Prisma `BigInt`; remember that JS `JSON.stringify` cannot serialize `bigint` directly. Convert to a string in response DTOs.
- Check the existing model/table mappings (`user`, `RefreshToken`, etc.) before changing `@@map` or `@map`.
- Do not create a second `User` or `RefreshToken` table.

---

# 5. What are diff analysis and AST analysis?

They are different tools that provide different kinds of evidence.

## Diff analysis

A diff compares text/file versions and shows added, removed, and changed lines. For example:

```diff
- if (paymentFailed) return error;
+ await retryPayment();
```

A diff is good at answering: **which lines changed between these two versions?**

A two-way base-versus-head diff is useful for display and narrowing candidate areas, but by itself it does not reliably tell whether two branches made incompatible changes relative to their shared ancestor.

## Three-way merge analysis

A Git merge conflict is determined using three versions:
- common ancestor (merge base);
- current target/base branch;
- PR source/head branch.

Git compares how each branch changed relative to their common ancestor and attempts to combine them. ConflictForge should use Git's merge machinery or an equivalent reliable three-way merge algorithm to identify actual merge conflicts. Do not rely only on overlapping diff line ranges, GitHub's `mergeable` boolean, or an LLM guess.

No repository code needs to be executed to perform this analysis. Use Git operations in a controlled temporary directory or another suitable merge implementation, and clean up temporary data.

## AST analysis

AST stands for **Abstract Syntax Tree**. A language parser turns source code into structured nodes such as classes, functions, methods, conditions, and calls.

For example, two branches may edit different lines in the same `processPayment()` method. A line-based diff can show the edits; AST analysis can tell the system they are within the same method or touch the same symbol.

AST analysis can help identify possible behavior-level/semantic conflicts and provide context to the LLM. It is language-specific, needs a parser for the language, and does not prove that a Git merge conflict exists. Start with the primary language needed for the MVP and add others deliberately.

Recommended order:
1. actual three-way merge for confirmed merge conflicts;
2. diff/hunk analysis to locate and explain changed regions;
3. AST analysis as structural enrichment;
4. LLM for explanation and suggested strategy, not as the sole conflict detector.

---

# 6. Backend architecture and request lifecycle

Use a modular monolith: one Express application with clear internal modules.

```text
Frontend / Axios
  |
  v
Global security, CORS, body-parser and cookie middleware
  |
  v
Express route
  |
  v
verifyAuth middleware (for protected app routes)
  |
  v
Controller: validate request and map HTTP response
  |
  v
Service: business workflow / orchestration
  |                         |
  v                         v
GitHub service           Prisma repository modules
  |                         |
  v                         v
GitHub API               Shared Prisma Client -> MySQL
  |
  v
Source retrieval at exact SHAs
  |
  v
Three-way merge -> diff analysis -> optional AST
  |
  v
Conflict context builder -> LLM service -> output validation
  |
  v
Prisma transaction: replace current findings on success
  |
  v
Controller serializer -> JSON response -> frontend
```

## Layer responsibilities

- **Global middleware:** use the existing security middleware, CORS, request parsers, and cookie parser. Check the existing 10 KB body limit before designing new endpoints; large code/file payloads should not be sent from the frontend, and source retrieval should be server-to-server.
- **Route:** maps method/path to middleware and controller.
- **Authentication middleware:** verifies the app access token and sets `req.user`. For protected routes use the existing mechanism.
- **Controller:** validates URL parameters/body, invokes one service, returns normalized JSON and correct HTTP status. No raw Prisma queries or GitHub orchestration here.
- **Service:** coordinates work and enforces business rules.
- **GitHub service:** owns GitHub API authentication, URL/metadata/file/PR calls, pagination, timeouts, rate-limit handling, and normalized provider errors.
- **Repository modules:** encapsulate Prisma queries using the one shared Prisma Client.
- **Analysis modules:** perform merge/diff/AST/context/LLM operations and persist valid results.

### Suggested backend additions

Adapt names to the existing codebase. The current folders are `controllers/`, `middlewares/`, `repository/`, `routes/`, `services/`, `utils/`.

```text
src/
  controllers/
    repository.controller.js
    pull-request.controller.js
    analysis.controller.js
    chat.controller.js                 # add when chat endpoint is implemented
  routes/
    repository.routes.js
    pull-request.routes.js
    analysis.routes.js
    chat.routes.js                     # add when chat endpoint is implemented
  services/
    github.service.js
    repository.service.js
    pull-request.service.js
    analysis.service.js
    merge.service.js
    diff.service.js
    ast.service.js                     # only for supported language(s)
    conflict-context.service.js
    llm.service.js
    chat.service.js                    # when chat endpoint is implemented
  repository/
    repository.repository.js
    pull-request.repository.js
    conflict.repository.js
```

Do not create empty modules just to match this tree. Inspect and reuse existing conventions.

---

# 7. End-to-end flow: what happens and what gets stored

This section follows the lifecycle from the first repository request through displaying analysis.

## Flow A — User signs in

1. Browser sends Google ID token to `POST /api/auth/signin`.
2. Existing route/controller/service verify the Google token.
3. `user.repository.js` creates/updates the existing `User` row.
4. `token.repository.js` stores a hash of the refresh token in `RefreshToken`; the raw refresh token is in the HTTP-only cookie.
5. The frontend keeps the short-lived access JWT in memory according to the existing design.

**Tables changed:** `User`, `RefreshToken`. No repository/PR/conflict rows yet.

## Flow B — User submits a repository URL

Example endpoint:

```http
POST /api/repositories
```

Example body:

```json
{
  "repoUrl": "https://github.com/owner/repository"
}
```

Sequence:
1. Security/transport middleware parses the request.
2. Existing `verifyAuth` middleware validates the ConflictForge access JWT and sets `req.user`.
3. `repository.routes.js` dispatches to `repository.controller.js`.
4. Controller validates the request shape and URL.
5. `repository.service.js` parses the host/owner/name and coordinates the operation.
6. `github.service.js` requests repository metadata and verifies it is readable. Public repo: public access can work. Private repo: use the separately authorized GitHub App/credential. Do not compare the GitHub owner to the Google identity.
7. `repository.repository.js` creates or updates the local row for this signed-in app user and remote GitHub repository.
8. Controller returns the normalized repository DTO.

**Table changed:** `Repository` (the `User` table is not recreated). Store local user ID, GitHub repo ID, owner/name/full name/URL/default branch/visibility. Do not fetch other repositories automatically.

Failure examples:
- malformed URL -> `400`;
- repository not found/inaccessible -> safe `404`/`403` result as appropriate;
- private repo but no GitHub permission -> authorization failure with a clear instruction to grant GitHub access.
Do not reveal private-repository details to someone who lacks access.

## Flow C — User opens the PR list

Example endpoint:

```http
GET /api/repositories/:repositoryId/pull-requests?state=open&page=1&perPage=20
```

Sequence:
1. Authentication middleware identifies the ConflictForge user.
2. Controller validates `repositoryId`, state, and pagination.
3. `pull-request.service.js` loads the local repository and checks local app access for `req.user.id`.
4. GitHub service fetches the selected repository's PR list with pagination, using the correct public/private access method.
5. The service maps the response to normalized fields and upserts local `PullRequest` records.
6. Response shows the list and latest known analysis status.

**Table changed:** `PullRequest` rows for returned PRs. Store:
- repository foreign key;
- GitHub PR number;
- title/body/state;
- base and head branch names;
- latest known base/head SHAs;
- GitHub `mergeable` state if returned;
- default `analysisStatus = NOT_ANALYZED` for new rows.

Use unique `(repositoryId, githubPrNumber)` to update the same local PR rather than duplicate it. Do not persist every changed file or every commit at this stage.

## Flow D — User opens a PR

Example endpoint:

```http
GET /api/repositories/:repositoryId/pull-requests/:prNumber
```

Sequence:
1. Authenticate and check local repository/PR access.
2. Fetch the latest PR details from GitHub.
3. Update the local PR metadata and latest base/head SHAs.
4. Return PR details, `mergeable`, `analysisStatus`, last successful analyzed SHAs, and whether the latest results are stale.

**Table changed:** the relevant `PullRequest` row.

If `baseSha !== analyzedBaseSha` or `headSha !== analyzedHeadSha`, a prior result is stale. The UI should say so and offer re-analysis. `mergeable = null` means GitHub has not returned a definitive result yet, not that no conflict exists.

## Flow E — User clicks Analyze / Re-analyze

Example endpoint:

```http
POST /api/repositories/:repositoryId/pull-requests/:prNumber/analyze
```

Sequence:
1. Authenticate, resolve the local repository/PR, and enforce app-level access.
2. GitHub service fetches current PR metadata and exact base/head SHAs.
3. Update `PullRequest.baseSha` and `headSha` with the latest observed SHAs; set `analysisStatus = RUNNING` and `analysisStartedAt`.
4. Keep any previous successful `Conflict` rows and previous `analyzedBaseSha`/`analyzedHeadSha` during the run. Do not delete them at the start.
5. Retrieve the common ancestor/merge base and code versions for relevant changed files at the exact SHAs.
6. Run Git three-way merge analysis. Collect confirmed conflict regions. Run diff analysis and optional supported-language AST analysis for added context.
7. Build a bounded context object per conflict (PR details, exact SHAs, line ranges, snippets, relevant diff, AST/symbol data, selected commits).
8. Call the LLM for explanation and recommended strategies. Validate its structured output. Treat repository content as untrusted prompt input.
9. Verify the analyzed SHAs are still the expected versions. If PR/base changed during the run, do not silently save results as current; abort/retry or mark them stale.
10. On success, execute a Prisma transaction:
   - delete the prior current `Conflict` rows for this PR;
   - insert new findings (zero rows is valid if no conflicts were found);
   - update `analyzedBaseSha` and `analyzedHeadSha`;
   - set `hasConflicts` true/false if that field exists;
   - set `analysisStatus = COMPLETED` and `analysisCompletedAt`;
   - clear `analysisError`.
11. Return the completed summary and conflict data, or return `202 Accepted` plus status if analysis is processed asynchronously.

**Tables changed:** `PullRequest` and `Conflict`.

On failure:
- set `analysisStatus = FAILED` and a safe `analysisError`;
- preserve the prior successful `Conflict` rows;
- do not change `analyzedBaseSha`/`analyzedHeadSha` to the failed run's SHAs;
- if previous findings exist, mark them as from the last successful analyzed SHAs and stale as needed.

For a small synchronous prototype, the request may wait for the analysis. If it becomes long-running, use durable queue/worker infrastructure later; an in-memory background task is lost if the server restarts.

## Flow F — Frontend retrieves conflict findings

Example endpoint:

```http
GET /api/repositories/:repositoryId/pull-requests/:prNumber/conflicts
```

The service checks access and returns:
- analysis status;
- exact SHAs of the latest successful analysis;
- conflict type/risk/file/line ranges;
- excerpts, explanation, suggested resolution;
- stale indicator or enough SHA information for the frontend to determine staleness.

**Tables read:** `PullRequest`, `Conflict`. No data needs to be written for a read-only view.

An empty `Conflict` list means “no conflicts” only when `analysisStatus = COMPLETED` for a successful analysis at the relevant SHAs. Before analysis or after failure, an empty list does not prove a clean PR.

## Flow G — Frontend requests full-file code for Monaco

Monaco does not fetch GitHub files on its own. The frontend should request exact source versions from ConflictForge, for example:

```http
GET /api/repositories/:repositoryId/pull-requests/:prNumber/source?path=src%2FPaymentService.js
```

The server:
1. authenticates and checks repository/PR access;
2. resolves the same base/head SHAs used by the selected analysis;
3. fetches the file from GitHub at those exact SHAs (and ancestor when useful);
4. returns file contents, path, language, and version SHAs;
5. may use a bounded short-lived cache later if file retrieval becomes expensive.

Avoid storing entire files in each `Conflict` row. If only snippets exist, return a snippet view and label it as such rather than presenting it as the complete file.

**Tables typically read:** `Repository`, `PullRequest`, and possibly `Conflict` to validate the file/finding. No full code is written to MySQL by default.

## Flow H — User sends an AI chat message

Proposed endpoint (add only when implementing chat):

```http
POST /api/repositories/:repositoryId/pull-requests/:prNumber/conflicts/:conflictId/chat
```

Example body:

```json
{
  "message": "Can these changes be combined safely?"
}
```

Sequence:
1. Authenticate and check access to the PR and specific conflict.
2. `chat.service.js` loads the finding and its analyzed context.
3. Backend builds context from trusted stored/fetched data and the current user message.
4. LLM returns a response; validate its shape and handle provider errors.
5. Return the answer and code snippets/line references if supported.

For the MVP, chat history can remain in frontend memory and be sent as a bounded conversation context, unless persistent history is explicitly required. Do not create a chat-history table merely for the first version. The server must not trust arbitrary client-supplied repository code as authoritative context.

**Tables read:** `Repository`, `PullRequest`, `Conflict`. No chat table is required initially.

---

# 8. GitHub endpoints and their jobs

Use a shared `github.service.js`; avoid raw GitHub fetch calls spread throughout controllers.

| GitHub API / operation | Use |
|---|---|
| `GET /repos/{owner}/{repo}` | Validate repository and obtain GitHub ID, owner, name, default branch, visibility |
| `GET /repos/{owner}/{repo}/pulls?state=open` | List PRs |
| `GET /repos/{owner}/{repo}/pulls/{number}` | Fetch branches, SHAs, title/body/state, mergeability |
| `GET /repos/{owner}/{repo}/pulls/{number}/files` | Changed file names and available patch data |
| `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}` | Retrieve a file at an exact SHA when suitable |
| `GET /repos/{owner}/{repo}/compare/{base}...{head}` | Relevant commits/diff comparison where suitable |
| Git operations / equivalent merge engine | Reliable three-way merge and actual conflict regions |

Handle pagination, timeouts, rate limits, missing files, and GitHub's nullable `mergeable` value. A PR patch is not guaranteed to contain all data required to construct a three-way merge.

---

# 9. Backend routes and frontend pages

## Backend API routes

Use these as a target. Reuse an existing prefix if the project already has one.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/repositories` | Validate/add the submitted repository URL |
| `GET` | `/api/repositories` | List repositories submitted by the current ConflictForge user |
| `GET` | `/api/repositories/:repositoryId` | Repository overview with access check |
| `GET` | `/api/repositories/:repositoryId/pull-requests` | List PRs |
| `GET` | `/api/repositories/:repositoryId/pull-requests/:prNumber` | PR details and latest analysis state |
| `POST` | `/api/repositories/:repositoryId/pull-requests/:prNumber/analyze` | Analyze or re-analyze |
| `GET` | `/api/repositories/:repositoryId/pull-requests/:prNumber/conflicts` | Latest stored findings |
| `GET` | `/api/repositories/:repositoryId/pull-requests/:prNumber/source?path=...` | Full file content at analyzed SHAs for Monaco |
| `POST` | `/api/repositories/:repositoryId/pull-requests/:prNumber/conflicts/:conflictId/chat` | Contextual AI chat; implement when chat is in scope |

For each endpoint, define request validation and a consistent success/error response using the existing serializers and error middleware. Do not expose raw tokens, raw provider errors, stack traces in production, or unnecessary fields from Prisma models.

## Frontend routes/pages

The attached backend documentation describes React + Vite with Axios. Inspect the actual frontend project first and use its existing router/design system.

| Frontend route | Purpose and integration |
|---|---|
| `/login` | Existing Google sign-in flow |
| `/repositories` | Show the current app user's added repositories via `GET /api/repositories` |
| `/repositories/add` | Submit a repository URL |
| `/repositories/:repositoryId` | Repository overview |
| `/repositories/:repositoryId/pull-requests` | List/select PRs |
| `/repositories/:repositoryId/pull-requests/:prNumber` | PR overview and analysis status |
| `/repositories/:repositoryId/pull-requests/:prNumber/analysis` | Main code/conflict/AI workspace |

The PR overview and analysis workspace can be one page in the MVP if that simplifies navigation.

---

# 10. Monaco Diff Editor: what it does and what backend must do

## Monaco's job

Monaco is the code editor UI used by VS Code. Its Diff Editor can compare two text strings and visually display:
- added/removed/changed lines;
- syntax highlighting;
- line numbers;
- scrollable side-by-side panes;
- navigation/reveal of known line ranges;
- decorations/highlights when the application supplies them.

Use two explicitly labelled versions:
- **Base / target:** file content at the analyzed `baseSha`.
- **Head / PR branch:** file content at the analyzed `headSha`.

The first implementation should be read-only.

## Backend's job

The backend must:
- fetch the exact file contents at the right SHAs, especially for private repositories;
- establish which versions are being compared;
- run three-way merge logic to identify actual conflict regions;
- return the resulting conflict ranges and relevant metadata;
- optionally return ancestor content/context for explaining how the changes diverged.

Monaco does **not** know the PR's Git merge base, does not authorize GitHub access, and does not determine whether a conflict is semantically dangerous. It visualizes the text it receives. A Monaco two-way diff is useful for review but is not a replacement for backend three-way merge analysis.

For finding navigation, the frontend uses the file path and version-specific line ranges returned by the backend and calls Monaco's reveal/decoration APIs. If the backend cannot identify a trustworthy range, show the finding without inventing a line highlight.

## Suggested desktop workspace

```text
+---------------------+--------------------------------------+-----------------------+
| Repository / PR     | Code workspace                       | ConflictForge AI      |
|                     |                                      |                       |
| Changed files       | Base / target  | Head / PR branch     | Summary               |
| Conflict findings   | Monaco Diff Editor                    | Messages              |
|                     |                                      | Prompt input          |
+---------------------+--------------------------------------+-----------------------+
```

Left: changed files and findings grouped by file.  
Center: Monaco Diff Editor with file tabs/modes.  
Right: explanation, suggested resolution, and chat.

On narrow screens, turn the side panels into drawers/tabs rather than squeezing three columns.

### Editor modes

- **Diff:** base versus head.
- **Conflict:** jump to a confirmed conflict range.
- **Base:** inspect base version.
- **Head:** inspect PR version.
- **Ancestor/context:** optional, only when the backend provides it.

Do not label a base-versus-head visual comparison as a three-way merge result unless the backend actually returns the result of a merge computation.

## Frontend components

Adapt component names to the existing framework:

```text
api/
  repositories.api.js
  pull-requests.api.js
  analysis.api.js
  chat.api.js

components/
  RepositoryList
  PullRequestList
  ConflictList
  MonacoDiffViewer
  AnalysisSummary
  ConflictChatPanel

pages/
  Repositories
  AddRepository
  PullRequestOverview
  AnalysisWorkspace
```

Keep routes, API calls, Monaco setup, conflict list, and chat in separate components/modules. The workspace should track the selected file, selected finding, editor mode, analysis status, analyzed SHAs, chat messages, and per-operation loading/error states.

## AI chat

The right-side AI panel should:
- show the selected conflict's explanation and recommendation;
- allow follow-up questions;
- send the selected PR/conflict IDs and message to the backend;
- render responses and code snippets, with a copy action;
- show loading/retry/error states.

The backend must rebuild context from stored/fetched trusted data and verify access. Do not send the entire repository with each question. Chat history can remain in frontend memory in the MVP; only add a persistent chat table if durable history is a real requirement.

---

# 11. Storage and consistency rules

Use these meanings consistently:

- `baseSha` / `headSha`: latest versions observed from GitHub.
- `analyzedBaseSha` / `analyzedHeadSha`: versions used by the last successful analysis.
- `mergeable`: GitHub's mergeability state, which may be unknown.
- `hasConflicts`: ConflictForge's summary after its own successful analysis, nullable before the first success.
- `analysisStatus`: state of the latest attempt.
- `Conflict` records: findings from the last successful analysis only.

### Successful analysis

Only after analysis and LLM validation finish successfully:
- verify SHAs have not changed;
- use one Prisma transaction to replace old current conflict rows, write new findings, update analyzed SHAs/status/timestamps, and set `hasConflicts` if retained.

An analysis that completes with no conflicts should set `analysisStatus = COMPLETED`, `hasConflicts = false` if the field is kept, record successful analyzed SHAs, and store zero conflict rows.

### Failed analysis

- Set the attempt status to `FAILED` and save a safe error summary.
- Preserve last successful conflict rows.
- Do not advance `analyzedBaseSha` / `analyzedHeadSha`.
- Frontend must be able to identify whether retained rows are stale.

This means `analysisStatus = FAILED` can coexist with older saved conflict findings: the status refers to the latest attempt; the findings/`analyzed*Sha` refer to the last successful result.

### Avoid storing unnecessary data

Do not persist the whole repository, all commits, or whole source files in each conflict. Store metadata, exact SHAs, line ranges, concise excerpts and diff hunks, AST/commit context where useful, plus the analysis. Fetch full source on demand for Monaco.

Private repository source code is sensitive. Use size limits, avoid unnecessary logs, and consider retention/cache rules before storing any full-source snapshots.

---

# 12. Security, failure handling, and reliability

- Use the current Google/JWT auth system for app identity.
- Keep GitHub repository authorization separate from Google login.
- Validate repository host/URL and sanitize paths/query parameters.
- Check local app-user access for stored repositories, PRs, and conflicts.
- For private repos, require GitHub App/OAuth authorization with appropriate read permissions.
- Never expose GitHub credentials or refresh tokens to the frontend.
- Respect GitHub pagination, rate limits, timeouts, and provider errors.
- Handle `mergeable: null` as unknown/pending.
- Treat source files, PR descriptions and commit messages as untrusted input for LLM prompts.
- Request structured LLM output and validate it before persistence.
- Use transactions to persist current findings atomically.
- Prevent stale/concurrent analyses from overwriting results for newer SHAs.
- Do not execute source code or tests in Phase 1.
- Avoid logging full private code by default.
- Use current error middleware and consistent serializers.
- Keep the existing body-size limits; do not send whole files from the browser to the backend for analysis.

Handle at least: invalid URL, inaccessible repo, missing GitHub permission, missing PR/file at an SHA, rate limiting, LLM timeout/malformed result, analysis failure, DB transaction failure, and PR/base changing during analysis.

---

# 13. Implementation order for the coding agent

## Stage 1 — inspect before editing

1. Read `package.json`, the real `schema.prisma`, current migration history, `server.js`, `env.js`, `prisma.js`, auth routes/services, middleware, repositories, and serializers.
2. Confirm existing `User` and `RefreshToken` tables are preserved.
3. Confirm Prisma connection and migration setup work.
4. Inspect the frontend framework/router and Axios/token handling.

## Stage 2 — database

1. Add the relation from the existing `User` model to `Repository`.
2. Add `Repository`, `PullRequest`, `Conflict` and relevant enums/constraints.
3. Match FK column types to the existing `User.id`.
4. Create and validate migration without resetting existing data.
5. Generate Prisma Client.

## Stage 3 — repository URL/API

1. Implement shared GitHub service and secure access strategy.
2. Implement URL validation and `POST /api/repositories`.
3. Implement `GET /api/repositories` scoped to the app user.
4. Test public repo, invalid URL, inaccessible repo, and private repo without/with GitHub authorization.

## Stage 4 — PR metadata

1. Implement PR listing with pagination.
2. Implement PR detail lookup.
3. Persist PR metadata and base/head SHAs.
4. Test pagination, rate limits, and unknown mergeability.

## Stage 5 — analysis

1. Implement status transitions.
2. Retrieve exact file versions and merge base.
3. Implement three-way merge conflict detection.
4. Add diff analysis, then AST enrichment for an explicitly supported language.
5. Build bounded context, call LLM, validate structured output.
6. Persist findings atomically and preserve last successful results on failure.
7. Implement source retrieval endpoint for Monaco at analyzed SHAs.

## Stage 6 — frontend

1. Build repository list/add flow.
2. Build PR list and overview/status.
3. Add analysis trigger and status refresh/polling if asynchronous.
4. Build three-panel analysis workspace.
5. Wire Monaco Diff Editor to exact source contents and server-supplied conflict ranges.
6. Add explanation panel and contextual chat after the chat endpoint exists.
7. Handle loading, empty, failed, stale, and unsupported-source states.

## Stage 7 — hardening

Test authorization, stale SHA handling, concurrency, transaction rollback, failed analysis preserving old findings, GitHub/LLM failures, DTO serialization, and Monaco showing the correct versions.

---

# 14. Definition of done

- Existing Google sign-in and refresh-token flow still works.
- Existing `User`/`RefreshToken` tables and model definitions remain intact.
- The user can submit one repository URL without syncing their entire GitHub account.
- Public repositories work; private repositories require a real GitHub permission grant.
- The backend does not require the GitHub repo owner to match the Google user.
- Local repository/PR/finding records remain access-controlled.
- PR metadata and exact base/head SHAs are persisted.
- Unknown, running, completed, and failed analysis states are distinct.
- Actual Git merge conflicts come from three-way merge behavior.
- Diff/AST/LLM provide context and explanation rather than replacing merge detection.
- Conflict rows contain concise excerpts, not repeated full-file copies.
- Monaco compares source content fetched at the exact analyzed SHAs and navigates to backend-provided ranges.
- Failure or stale analysis never gets presented as a current verified result.
- AI output is validated and used as advice, not silently applied.
- The agent reports what was changed, tests run, migration status, and known limitations.

# 15. Final instructions

Do not blindly apply this document. Inspect the real codebase and explain mismatches before editing. Preserve existing JavaScript conventions and working authentication/configuration. Do not add unnecessary tables, queues, microservices, automatic merge capabilities, or sandbox execution. Implement incrementally, test each stage, and never claim a migration or test passed unless it actually did.
