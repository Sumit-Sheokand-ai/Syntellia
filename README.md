# Syntellia

Syntellia is a UI and UX intelligence product that scans a page or bounded crawl,
extracts design patterns, and returns structured audit data about the target
interface.

The current repository is an implementation baseline, not the final product.
The frontend experience, mock scan flow, report contract, and worker direction
are in place so the next phase can focus on replacing mock infrastructure with a
real crawl and persistence pipeline.

## Product Goal

Given a target URL, Syntellia should:

1. Open the page or bounded site crawl.
2. Extract used visual styles such as colors, typography, spacing, layout, and component patterns.
3. Interpret UX and interaction signals such as CTA density, hierarchy, navigation depth, and form friction.
4. Return structured data and a mature report UI that is useful to designers, founders, and frontend teams.

## Current State

What is already implemented:

- A Next.js app in `apps/web`.
- A polished marketing page with rich gradient blending and React Bits-style animated components.
- An analyzer shell with dashboard, new scan form, and dynamic report route.
- Mock scan APIs for creating and reading scans.
- An in-memory mock scan store that returns seeded structured reports.
- A worker stub in `packages/worker` that represents the future crawl job boundary.
- A clean production build from the repository root using `npm run build`.

What is still mocked:

- Scan persistence.
- Authentication.
- Playwright crawling.
- Style extraction.
- Screenshot capture.
- Queue processing.
- Real report generation.

## Workspace Layout

```text
Syntellia/
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ page.tsx
│     │  ├─ app/
│     │  │  ├─ dashboard/
│     │  │  ├─ scan/new/
│     │  │  └─ scan/[scanId]/
│     │  └─ api/scans/
│     ├─ components/
│     │  ├─ reactbits/
│     │  ├─ report/
│     │  └─ ui/
│     └─ lib/
│        ├─ mock-report.ts
│        ├─ mock-scan-store.ts
│        └─ report-schema.ts
└─ packages/
	└─ worker/
		└─ src/
			├─ index.js
			└─ queue.js
```

## Implemented Routes

Frontend routes:

- `/` : marketing homepage
- `/app/dashboard` : analyzer dashboard shell
- `/app/scan/new` : scan configuration form
- `/app/scan/[scanId]` : report viewer

API routes:

- `/api/scans` : list scans and create a scan
- `/api/scans/[scanId]` : fetch a single scan

## Stack

Current stack:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Motion
- npm workspaces

Current UI direction:

- Mature dark visual system
- Rich color blending and layered gradients
- Glass and panel depth
- Local React Bits-style motion components instead of a brittle third-party bundle

## Commands

From the repository root:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run worker:dev
```

What each command does:

- `npm run dev` starts the Next.js app in `apps/web`.
- `npm run build` runs the production build for the web app.
- `npm run lint` runs Next.js linting for the web app.
- `npm run worker:dev` runs the synthetic worker stub.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Run the web app

```bash
npm run dev
```

### 3. Open the current surfaces

- Visit `http://localhost:3000/`
- Open the scan flow at `http://localhost:3000/app/scan/new`
- Submit a scan URL to generate a mock report route

### 4. Validate the baseline

```bash
npm run build
```

This should succeed before starting any major new feature work.

## Important Files

Core product surfaces:

- `apps/web/app/page.tsx`
- `apps/web/app/app/dashboard/page.tsx`
- `apps/web/app/app/scan/new/page.tsx`
- `apps/web/app/app/scan/[scanId]/page.tsx`

Mock API and report logic:

- `apps/web/app/api/scans/route.ts`
- `apps/web/app/api/scans/[scanId]/route.ts`
- `apps/web/lib/mock-scan-store.ts`
- `apps/web/lib/mock-report.ts`
- `apps/web/lib/report-schema.ts`

Reusable UI:

- `apps/web/components/reactbits/blur-text.tsx`
- `apps/web/components/reactbits/gradient-text.tsx`
- `apps/web/components/reactbits/click-spark.tsx`
- `apps/web/components/reactbits/star-border.tsx`
- `apps/web/components/report/report-overview.tsx`
- `apps/web/components/ui/shell-card.tsx`

Worker direction:

- `packages/worker/src/index.js`
- `packages/worker/src/queue.js`

## What The Mock Flow Does Today

The current scan flow is deliberately simple:

1. The user submits a URL and scan preferences from `/app/scan/new`.
2. The app posts to `/api/scans`.
3. A scan record is generated in memory.
4. A seeded structured report is attached to that scan.
5. The app redirects to `/app/scan/[scanId]` and renders the report.

This is useful because it locks down:

- page structure
- route contracts
- report rendering expectations
- expected scan input fields
- future backend handoff points

## Recommended Next Steps

The next phase should be implemented in the order below.

### Phase 1: Real data model

Goal:
Replace the in-memory scan store with a real database-backed model.

Tasks:

1. Add Prisma.
2. Add PostgreSQL.
3. Model `User`, `Scan`, `PageResult`, `Screenshot`, and `Finding`.
4. Replace `mock-scan-store.ts` with database reads and writes.
5. Keep the current API route shapes stable while swapping storage underneath.

Definition of done:

- Scan creation persists across restarts.
- Reports load from database-backed records.
- Current routes continue to work.

### Phase 2: Authentication

Goal:
Introduce account-scoped access and saved scan history.

Tasks:

1. Add Auth.js.
2. Add sign-in and sign-out flows.
3. Scope scans to the authenticated user.
4. Add a scan history list to the dashboard.
5. Guard report routes so users only see their own scans.

Definition of done:

- A user can log in.
- A user can create and revisit their own scans.
- Scan ownership is enforced.

### Phase 3: Queue and worker boundary

Goal:
Move scan creation off the request path and into background jobs.

Tasks:

1. Add Redis.
2. Replace the worker stub with a BullMQ-based job processor.
3. Change `/api/scans` to enqueue jobs instead of immediately returning completed reports.
4. Add scan status values like `queued`, `running`, `completed`, and `failed`.
5. Reflect live status in the dashboard and report route.

Definition of done:

- Creating a scan enqueues work.
- Worker consumes jobs.
- UI reflects job status correctly.

### Phase 4: Playwright crawler

Goal:
Collect real page data from public targets first.

Tasks:

1. Add Playwright to the worker package.
2. Open the target URL in a browser context.
3. Respect same-domain and bounded crawl rules.
4. Capture DOM snapshots and screenshots.
5. Store page-level results in the database.

Definition of done:

- Public pages can be crawled.
- At least one page result is stored per scan.
- Screenshot capture works.

### Phase 5: Extraction engine

Goal:
Replace seeded report content with real style and UX extraction.

Tasks:

1. Extract dominant colors and token candidates from computed styles.
2. Extract typography roles, spacing patterns, border radius, and elevation patterns.
3. Detect common UI patterns such as hero sections, feature cards, navs, forms, modals, and CTAs.
4. Add heuristic findings for hierarchy, contrast risk, CTA overload, and interaction density.
5. Normalize everything into `report-schema.ts`.

Definition of done:

- Report pages render real extracted data.
- Mock report fallback is no longer needed for standard scans.

### Phase 6: Authenticated scans

Goal:
Support protected pages in a bounded, explicit way.

Tasks:

1. Define supported auth modes for v1.
2. Start with session cookie import and simple login form automation.
3. Exclude MFA, CAPTCHA bypassing, and SSO from the initial version.
4. Store auth metadata securely and minimally.
5. Show clear limitations in the UI.

Definition of done:

- Protected scans work for supported auth patterns.
- Failure states are visible and understandable.

## Immediate Engineering Priorities

If continuing implementation today, work in this order:

1. Add Prisma and PostgreSQL.
2. Replace mock scan store with persistent records.
3. Add dashboard scan history.
4. Add BullMQ and Redis.
5. Move report completion into a worker job.
6. Add Playwright public-page crawl.
7. Add real report extraction.

## Suggested Data Model

Start with the following tables or Prisma models:

- `User`
- `Scan`
- `ScanPage`
- `ScanFinding`
- `ScanTokenGroup`
- `ScanComponent`
- `ScanScreenshot`

Suggested `Scan` fields:

- `id`
- `userId`
- `url`
- `status`
- `crawlDepth`
- `pageLimit`
- `authMode`
- `analysisFocus`
- `createdAt`
- `updatedAt`
- `completedAt`

## Suggested Environment Variables

These are not all required yet, but the project should move toward them:

```bash
DATABASE_URL=
REDIS_URL=
AUTH_SECRET=
NEXTAUTH_URL=
PLAYWRIGHT_HEADLESS=true
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

## UX and Design Guardrails

The product asks users to evaluate design maturity, so the product UI itself has
to feel deliberate.

Keep these guardrails in place:

- Avoid generic dashboard styling.
- Preserve the blended-color, premium panel, and glass-depth language already started.
- Use motion sparingly and purposefully.
- Keep report views dense but readable.
- Treat the landing page and app shell as one coherent brand system.

## Known Constraints

- The worker is currently a stub and does not crawl.
- Scan storage is currently in memory and resets on restart.
- API routes currently return mock-backed data.
- Auth is not implemented.
- The report viewer is ready for real data, but the extraction engine is not built yet.

## Definition Of A Strong Next Milestone

The next meaningful milestone is not “more UI”.

It is this:

1. Persist scans in PostgreSQL.
2. Enqueue them in Redis.
3. Run a worker job.
4. Crawl a public page with Playwright.
5. Store at least one real page result.
6. Render that result through the existing report UI.

When that is complete, the project moves from polished prototype to real product foundation.

## Delivery Checklist

Use this before merging the next major phase:

- `npm install` succeeds from root.
- `npm run build` succeeds from root.
- No workspace diagnostics remain.
- New code keeps existing route structure intact unless there is a justified route redesign.
- UI remains visually consistent with the current design language.
- Any mock behavior removed is replaced with a stable interface, not an ad hoc shortcut.

## Short Version

If only one thing is needed next, do this:

Build the persistence and worker pipeline first. The UI baseline is already good enough to support that shift.
