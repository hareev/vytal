# Changelog

All notable changes to Vytal are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Vytal adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- Org comparison view (side-by-side health scores across multiple orgs)
- Sequence email delivery provider integrations (SendGrid, Resend, Postmark)
- Public customer knowledge portal (unauthenticated read-only view)
- Scan history trend lines in Dashboard

---

## [0.3.0] — 2026-05-19

### Added

**CRM health adapters**

- **Salesforce adapter** (`src/lib/adapters/salesforce.ts`) — REST + Tooling API; maps CustomObjects, CustomFields, Flows, DuplicateRules, User activity to `RawHealthPayload`; OAuth Connected App credentials
- **HubSpot adapter** (`src/lib/adapters/hubspot.ts`) — Private App Token auth; maps Properties API (contacts/companies/deals), automation flows, and user activity; automatic portal ID resolution from token introspection

**AI-powered intelligence layer**

- `src/lib/ai/dealIntelligence.ts` — Claude-powered deal scoring: close probability 0–100, risk level, observable signals, and recommended next action
- `src/lib/ai/enrichment.ts` — Contact enrichment from name + email domain + company; returns industry, size estimate, job title suggestion, LinkedIn hint, and confidence notes
- `src/lib/ai/autoSegment.ts` — Natural language → `SegmentFilter[]`; describe an audience in plain English and Claude generates the structured filters
- ✦ AI Intel button on pipeline deal cards (overlay with probability ring, risk badge, signals, recommendation)
- ✦ Enrich button in contact detail panel (shows enrichment result inline)
- ✦ AI Segment button in Marketing segments tab (modal + pre-filled segment form)

**Knowledge Base module**

- `server/routes/kb.ts` — 9 endpoints: categories CRUD + articles CRUD + publish action
- `src/pages/knowledge/KnowledgeBase.tsx` — three-panel UI: category sidebar, article list, article detail; inline create/edit modals; empty state with CTA
- `src/hooks/useKbStore.ts` — Zustand store for categories, articles, and active article
- `server/db/schema.ts` — `kb_categories` and `kb_articles` tables
- Mock seed: 3 categories, 10 articles (mix of draft/published) in `src/lib/api/mock.ts`
- Sidebar nav entry (module-gated via `org.modules.knowledge`)

**Webhook system**

- `server/routes/webhooks.ts` — CRUD + test-ping endpoint; auto-generates HMAC-SHA256 signing secret; masks secret in responses; validates HTTPS URLs; 13 event types supported
- `server/lib/webhookDispatcher.ts` — parallel delivery with HMAC-SHA256 `X-Vytal-Signature` header; 5-second timeout per request; `Promise.allSettled` (never throws)
- `server/db/schema.ts` — `webhooks` table

**Sequence delivery engine**

- `server/routes/sequences.ts` — enrollment CRUD: enroll/unenroll contacts, list enrollments; fires `sequence.enrolled` and `sequence.completed` webhook events
- `server/lib/sequenceScheduler.ts` — 60-second polling loop; processes `email`/`wait`/`condition` steps; advances `current_step`, computes `next_send_at` from `delay_hours`; isolated per-enrollment error handling
- `server/db/schema.ts` — `sequence_enrollments` table

**Infrastructure**

- `Dockerfile` — multi-stage build: Vite frontend + Node API server in one image
- `Dockerfile.dev` — lightweight dev image for `docker compose up`
- `docker-compose.yml` — PostgreSQL 16 + API server + optional frontend dev service
- `.dockerignore`

### Changed

- `src/types/auth.ts` — added `knowledge: boolean` to `Org.modules`
- `server/db/schema.ts` — 5 new tables (now 18 total): `scan_history`, `webhooks`, `kb_categories`, `kb_articles`, `sequence_enrollments`
- `src/lib/adapters/index.ts` — Salesforce and HubSpot now use real adapter manifests and factory instances
- `package.json` — added `@hono/zod-validator` (was used across server routes but missing from dependencies)

---

## [0.2.0] — 2025-05-16

### Added

**Headless CRM platform**

- `server/` — Hono REST API server with full CRUD for all entities
- Drizzle ORM schema (13 tables): `organizations`, `users`, `contacts`,
  `pipelines`, `pipeline_stages`, `deals`, `activities`, `segments`,
  `campaigns`, `sequences`, `sequence_steps`, `tickets`, `ticket_messages`
- Neon (serverless Postgres) as the data layer; multi-tenant with `org_id` scoping
- JWT authentication with bcryptjs (30-day tokens, owner / admin / member roles)
- `src/lib/api/client.ts` — fully-typed fetch-based API client
- `src/lib/api/mock.ts` — in-memory mock with realistic seed data (works with
  `VITE_USE_MOCK=true`, no backend required)

**New modules**

- **Sales / Pipeline** — drag-and-drop kanban board, multi-pipeline selector,
  deal create / edit modal, contact linkage, per-column value totals
- **Sales / Contacts** — searchable + filterable table, right-side detail panel,
  linked deals, activity log, full CRUD
- **Marketing** — tabbed view: Campaigns (send stats, open/click rates),
  Segments (filter builder), Sequences (expandable step view)
- **Service** — SLA summary bar, priority-bordered ticket cards, SLA countdown
  timers, Conversation + Internal Notes panel per ticket

**Auth & onboarding**

- Login and Register pages
- 5-step onboarding wizard: workspace details → module selection → CRM connect
  → invite team → done (animated SVG checkmark)
- `useAuthStore` — login / register / logout / `loadFromStorage` session restore;
  pre-loaded demo workspace in mock mode

**Layout**

- `AppShell` + `Sidebar` — sticky sidebar with module navigation, org badge,
  plan indicator, user menu, and sign-out
- `Settings` page — workspace info, module toggles, API configuration reference

**Types**

- `src/types/auth.ts` — `User`, `Org`, `UserRole`, `OrgPlan`
- `src/types/crm.ts` — `Contact`, `Deal`, `Pipeline`, `Stage`, `Activity`
- `src/types/marketing.ts` — `Campaign`, `Segment`, `Sequence`, `SequenceStep`
- `src/types/service.ts` — `Ticket`, `TicketMessage`, `SLAPolicy`

**Tooling**

- `npm run dev:api` — API server (tsx watch)
- `npm run dev:all` — frontend + API in parallel (concurrently)
- `npm run db:push / db:generate / db:studio` — Drizzle database commands
- `tsconfig.server.json` — separate TypeScript config for the API
- `drizzle.config.ts` — Drizzle Kit configuration
- Vite dev proxy: `/api → http://localhost:3001`

### Changed

- Routing redesigned: `/ → /login` (unauthenticated) or `/ → /app`
  (authenticated); legacy `/connect` and `/dashboard` redirect automatically
- `App.tsx` rewritten with `AppShell` layout wrapping all protected routes
- `AIDiagnosisPanel.tsx` — fixed `React.ReactNode` to use `import type { ReactNode }`
- `.env.example` expanded with API server variables

### Fixed

- Missing `src/vite-env.d.ts` — caused `import.meta.env` TypeScript errors

---

## [0.1.0] — 2025-05-16

### Added

- Initial scaffold: Vite + React 18 + TypeScript (strict mode)
- `src/types/health.ts` — full data model: `CRMPlatform`, `OrgConnection`,
  `RawHealthPayload`, `ScoredHealthPayload`, `Issue`, `AIRecommendation`,
  `AIDiagnosis`
- **Dynamics 365 / Dataverse adapter** (`D365Adapter`) — OAuth 2.0 client
  credentials, Dataverse Web API v9.2; maps EntityDefinitions, Workflows,
  SystemUsers, DuplicateRules to `RawHealthPayload`
- Platform-agnostic **scoring engine** (`src/lib/scoring/engine.ts`) — five
  weighted dimensions (schema 25 %, automation 25 %, data quality 20 %,
  security 20 %, adoption 10 %)
- **Claude API integration** (`src/lib/ai/triage.ts`) — model
  `claude-sonnet-4-20250514`; structured JSON diagnosis with risk level,
  summary, and ranked recommendations
- `useVytalStore` — Zustand store for connection, health data, and diagnosis state
- `useScan` — orchestrates connect → fetch → score → AI diagnosis (non-blocking)
- `Connect` page — platform selector + credential form rendered from
  `AdapterManifest`
- `Dashboard` page — KPI row, score ring, dimension bars, issue list,
  AI diagnosis panel, org snapshot
- Adapter registry with stubs for Salesforce, Siebel, HubSpot, Custom
- `CONTRIBUTING.md`, `README.md`
- `.env.example` with `VITE_ANTHROPIC_API_KEY` placeholder
- `.gitignore`

---

[Unreleased]: https://github.com/hareev/vytal/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/hareev/vytal/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/hareev/vytal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hareev/vytal/releases/tag/v0.1.0
