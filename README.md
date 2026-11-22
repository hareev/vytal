# Vytal: CRM health intelligence, beyond headless CRM

> First, find out how healthy the CRMs you already run really are. Then build on an open-source, API-first CRM layer that sits above them.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![AI](https://img.shields.io/badge/AI-Claude%20API-orange)
![DB](https://img.shields.io/badge/database-Neon%20%2F%20Postgres-teal)

Vytal started as an open-source headless CRM. It now does two things, in this order:

1. **CRM health check (Vytal Scan).** A read-only scan of a Dynamics 365 or Salesforce org, scored across six dimensions, including process fit from real deal history. Every finding comes with evidence, and the result exports as a client-ready report. Anything Vytal can't measure is shown as *not measured*, never as healthy.
2. **Headless CRM platform.** A typed REST API (Hono, Drizzle, Postgres) with Sales, Marketing, Service, a Knowledge Base and signed webhooks, plus a React reference UI. Run it beside the CRMs you already have, or use it as the backend for your own frontend.

The health check tells you what is wrong with your CRM estate. The headless platform gives you one layer above it to work from.

**No vendor lock-in. Your data stays in your own database.**

- [Part 1: CRM health check](#part-1-crm-health-check)
- [Part 2: Headless CRM platform](#part-2-headless-crm-platform)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

# Part 1: CRM health check

Most CRM audits are manual, expensive and happen once a year. Vytal Scan runs a programmatic, read-only scan of an org and shows what it found, how it scored it, and what it could not measure.

## How a scan works

| Step | What happens |
|---|---|
| 1. Connect | Sign in to Dynamics 365 from the app, or reuse your Salesforce CLI login. No Connected App needed for Salesforce. |
| 2. Fetch | Read-only API calls pull schema, flows, users, security settings and deal stage history. |
| 3. Score | A six-dimension penalty model gives a 0 to 100 score from the checks it could measure. The rest are listed as not measured. |
| 4. Diagnose | Claude, called from the Vytal server, turns the scores into a prioritised action plan. |
| 5. Evidence | Export a client report (HTML) and an evidence file (JSON). The Salesforce scan also writes the query behind every metric and sample record IDs per finding. |

## Supported platforms

| Platform | Status |
|---|---|
| Dynamics 365 / Dataverse | ✅ Scanned from the app |
| Salesforce | 🧪 First slice, command line only (`npm run scan`) |
| HubSpot | 🔜 Planned |
| Zoho CRM | 📋 Planned |
| SugarCRM | 📋 Planned |
| Pega CRM | 📋 Planned |
| Freshsales | 📋 Planned |
| Pipedrive | 📋 Planned |

## Six health dimensions

| Dimension | Weight | Measures |
|---|---|---|
| Schema hygiene | 18.75% | Unused fields and entities, naming violations, deprecated objects |
| Automation complexity | 18.75% | Circular dependencies, nesting depth, missing error handling |
| Data quality | 15% | Duplicates, incomplete required fields, stale records |
| Security posture | 15% | Over-privileged roles, dormant admins, audit log gaps |
| Adoption health | 7.5% | Active user ratios, feature use |
| Process fit | 25% | Whether deals follow the sales process as built: skipped stages, backward moves, deals entered already closed |

Weights apply to measured dimensions only and are renormalised. When process fit is not measured (Dynamics 365 today, or a Salesforce org with too little deal history), the other five keep their original 25 : 25 : 20 : 20 : 10 split, so those scores are unchanged.

Checks a scan could not measure are reported as "not measured" and left out of the score. The overall score is weighted over the dimensions that were measured.

## Dynamics 365 scan (in the app)

Pick **Dynamics 365 / Dataverse** on the Connect page and enter the org URL, tenant ID, client ID and client secret of an app registration that can read the org. The scan runs on the Vytal server (`POST /api/health/d365/scan`), so the secret is not used in the browser.

**What it measures today:** total and custom entities, cloud and desktop flows (active and inactive), users, licensed users, System Administrator role members, and whether auditing is on.

**Not measured yet:** data quality, admin last sign-in (needs Microsoft Graph sign-in activity), field-level schema checks, flow nesting and error handling, and process fit. These show as "not measured".

## Salesforce scan (command line)

The first Salesforce slice runs from the command line and reuses your Salesforce CLI login, so no Connected App is needed.

```bash
sf org login web --alias my-org          # once, in your browser
npm run scan -- salesforce --target-org my-org --out reports
```

It prints a summary and writes `vytal-salesforce-<orgId>-<time>.json`: the scored result, the source query behind every metric, up to five sample record IDs per finding, and a list of what was not measured and why. The scan only sends GET requests and never changes the org. The file holds counts, setup names, stage names and record IDs, never record contents or the access token. Add `--json` to print the whole file instead of the summary.

**Permissions the scanning user needs:** API Enabled, View Setup and Configuration, and read access to Opportunity and its stage history. A permission that is missing only leaves its own metrics as "not measured".

**What it measures today**

| Area | Metrics | Source |
|---|---|---|
| Schema | Objects, own custom objects, custom objects with no records, custom fields | describeGlobal, `SELECT COUNT()` per object, Tooling `CustomField` |
| Automation | Flows (one per definition, not per version), active and inactive, active Process Builder processes | `FlowDefinitionView` |
| Security | Users, admins (Modify All Data or Customize Application), admins not logged in for 90 days, profiles and permission sets with Modify or View All Data, field history on Account and Opportunity | `User`, `PermissionSetAssignment`, Tooling `FieldDefinition` |
| Adoption | CRM-licensed users, users active in 30 days, flows per active user, setup changes in 30 days | `User.LastLoginDate`, `SetupAuditTrail` |
| Process fit | Closed deals in the last 365 days checked against the stages they actually passed through | `OpportunityStage`, `OpportunityHistory` |
| Reported, not scored | Salesforce Security Health Check score and high-risk settings, org limits at 80% or more, licence use | Tooling `SecurityHealthCheck`, `/limits`, `UserLicense` |

Process fit needs at least 20 closed deals with stage history (and 10 won deals for stage skipping). Below that it reports "not measured" rather than guessing. The "usual path" is the open stages at least half of won deals pass through, so orgs with several sales processes are not flagged for stages their deals never use.

**Not measured yet:** unused fields, naming rules, deprecated objects, flow nesting and error handling, all data quality checks, MFA, feature use, Workflow Rules.

**Defaults chosen for the first slice** (easy to change):
- Command line first; a server route and MCP tool can reuse `core/salesforce/` later.
- Sales process (Opportunity) first; Service (Case) process fit comes later.
- Standalone: no Org Check import. Salesforce Labs' Org Check stays the benchmark for metadata hygiene, and Vytal focuses on process fit and a cross-CRM score.
- Process fit carries 25% of the overall score when measured.

The Salesforce scan has been tested against a fake org in `tests/`, not yet against a live org.

## AI diagnosis

After a scan, the dashboard asks the server for a diagnosis (`POST /api/health/diagnosis`). The server sends the scores and issues to Claude and returns a risk level, a summary and ranked recommendations. `ANTHROPIC_API_KEY` lives on the server only and never reaches the browser.

## Exporting a client report

After a scan, the dashboard has two export buttons:

- **Export report** downloads a self-contained HTML report: summary and score, check coverage, scores by area (process fit included), findings with suggested fixes, the AI recommendations (when ready), how the scan works, and an appendix of every measured value. Open it in a browser and print or save as PDF to share.
- **Evidence (JSON)** downloads the same scan as data: measured values, scores, weights, issues and coverage.

Both files are built in the browser from the scan on screen; nothing is uploaded.

## Adding a new CRM connector

Implement `BaseAdapter` in `src/lib/adapters/base.ts`:

```typescript
export interface BaseAdapter {
  readonly name: string
  readonly platform: OrgConnection['platform']
  connect(credentials: Record<string, string>): Promise<OrgConnection>
  validateConnection(): Promise<boolean>
  fetchHealthPayload(): Promise<RawHealthPayload>
  disconnect?(): Promise<void>
}
```

Then register it in `src/lib/adapters/index.ts`. The scoring engine (`src/lib/scoring/engine.ts`) and the AI layer are platform-agnostic. Leave any metric you cannot query as `null` so it is reported as not measured.

---

# Part 2: Headless CRM platform

The second half of Vytal is an API-first CRM you own. Every feature in the reference UI goes through the same REST API, so you can swap in your own frontend, mobile app or integration.

## What's inside

| Module | Status | Description |
|---|---|---|
| **Sales** | Live | Contacts, drag-and-drop pipeline, deals, activities |
| **Marketing** | Live | Campaigns, audience segments, multi-step sequences with an enrolment scheduler |
| **Service** | Live | Support tickets, SLA tracking, internal notes, conversation threads |
| **Knowledge Base** | Live | Article categories, draft and published articles |
| **Webhooks** | Live | Outbound events signed with HMAC-SHA256 (`X-Vytal-Signature`) |
| **Channel Capture** | Preview | Pull signals from Gmail, Outlook, Slack, Teams and web forms, let Claude extract contacts and deals, then accept or dismiss each one |
| **CRM Validator** | Preview | Submit a CRM's repo or app URL for an AI review of features, gaps and fit |
| **Headless API** | Live | Full REST API (Hono), JWT auth, every resource scoped to an organisation |

"Preview" means the code is in the repo but the module is not finished; the project site lists it as coming soon.

## Quick start

### Option 1: Mock mode (no backend)

```bash
git clone https://github.com/hareev/vytal.git
cd vytal
npm install
cp .env.example .env          # VITE_USE_MOCK=true is already set
npm run dev:frontend
```

Open `http://localhost:5173`. You'll land on a pre-loaded workspace (Acme Corp) with sample contacts, deals, campaigns, tickets, sequences and knowledge base articles, all in memory.

### Option 2: Full stack with Postgres

```bash
# 1. Create a Neon project at neon.tech (or use the Postgres in docker-compose)
# 2. Configure .env
cp .env.example .env
# Fill in:
#   VITE_USE_MOCK=false
#   VITE_API_URL=http://localhost:3001/api
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=$(openssl rand -hex 32)
#   ANTHROPIC_API_KEY=sk-ant-...   (server only, for the AI features)

# 3. Push the schema to your database
npm run db:push

# 4. Run frontend and API together
npm run dev
```

### Deploying

- **Vercel:** `api/[[...route]].ts` serves the Hono API as a serverless function next to the Vite build, so the app and API share one domain. Set `VITE_API_URL=/api` in the Vercel project. `vercel.json` handles SPA routing.
- **Docker:** `docker compose up` starts Postgres 16 and the API; the `Dockerfile` builds the frontend and API into one image.

## Environment variables

### Frontend (`VITE_*`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_USE_MOCK` | No | `true` | Run without a backend using in-memory data |
| `VITE_API_URL` | No | `http://localhost:3001/api` on localhost, `/api` elsewhere | API base URL, including `/api` |

### API server

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (real mode) | Postgres connection string (Neon or any Postgres) |
| `JWT_SECRET` | Yes (real mode) | Random string for signing JWTs (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | For AI features | Used server side for the health diagnosis, CRM Validator and Channel Capture |
| `ANTHROPIC_MODEL` | No | Override the Claude model (default: `claude-sonnet-4-6`) |
| `PORT` | No | API server port (default: `3001`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `*`) |
| `GMAIL_*`, `MICROSOFT_*`, `SLACK_*` | For Channel Capture | OAuth client settings for Gmail, Outlook and Teams, and Slack; see `.env.example` |

## API reference

The API runs on port 3001. In development the Vite proxy forwards `/api` to it. Apart from register and login, and the public `/api/ingest/:source`, endpoints require `Authorization: Bearer <token>`.

### Auth

```
POST /api/auth/register   { orgName, email, name, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me
```

### Health check

```
POST /api/health/d365/scan       { orgUrl, tenantId, clientId, clientSecret }
POST /api/health/diagnosis       scores + issues → AI diagnosis
```

### CRM resources

```
GET    /api/contacts           ?search=&status=&page=&limit=
POST   /api/contacts
PATCH  /api/contacts/:id
DELETE /api/contacts/:id

GET    /api/deals              ?pipeline_id=&stage_id=&status=
POST   /api/deals
PATCH  /api/deals/:id

GET    /api/pipelines
POST   /api/pipelines
POST   /api/pipelines/:id/stages

GET    /api/campaigns          POST, PATCH /:id, DELETE /:id
GET    /api/segments           POST, PATCH /:id, DELETE /:id

GET    /api/sequences          POST, PATCH /:id, DELETE /:id
GET    /api/sequences/:id/enrollments
POST   /api/sequences/:id/enroll
DELETE /api/sequences/:id/enrollments/:enrollmentId

GET    /api/tickets            ?status=&priority=&assignee_id=
POST   /api/tickets            (auto-sets sla_due_at by priority)
PATCH  /api/tickets/:id
POST   /api/tickets/:id/messages

GET    /api/kb/categories      POST, PATCH /:id, DELETE /:id
GET    /api/kb/articles        POST, GET /:id, PATCH /:id, DELETE /:id
POST   /api/kb/articles/:id/publish

GET    /api/orgs               (org + aggregate stats)
PATCH  /api/orgs
GET    /api/orgs/members
POST   /api/orgs/members/invite
```

### Webhooks

```
GET    /api/webhooks           POST, PATCH /:id, DELETE /:id
POST   /api/webhooks/:id/test
```

### Channel Capture and integrations (preview)

```
GET    /api/captures           POST, GET /:id
POST   /api/captures/:id/process | /accept | /dismiss
POST   /api/ingest/:source     ?org_id=   (public: webhooks and embedded forms)
GET    /api/ingest/sources

GET    /api/integrations
GET    /api/integrations/:provider/connect | /callback
POST   /api/integrations/:provider/sync
DELETE /api/integrations/:provider
```

### CRM Validator (preview)

```
GET    /api/crm-reviews        POST, GET /:id
POST   /api/crm-reviews/:id/analyze
```

## Database schema

22 Postgres tables managed with Drizzle ORM. Tables carry `org_id` for multi-tenancy; child tables (pipeline stages, sequence steps, ticket messages) belong to their parent's organisation.

- **Core:** `organizations`, `users`
- **Sales:** `contacts`, `deals`, `activities`, `pipelines`, `pipeline_stages`
- **Marketing:** `segments`, `campaigns`, `sequences`, `sequence_steps`, `sequence_enrollments`
- **Service and knowledge:** `tickets`, `ticket_messages`, `kb_categories`, `kb_articles`
- **Platform:** `webhooks`, `integrations`, `channel_captures`, `channel_events`, `crm_submissions`, `scan_history`

Run `npm run db:studio` to browse data in Drizzle Studio.

## Project layout

```
vytal/
├── core/salesforce/      # Salesforce scan: client, scan, process fit
├── cli/vytal.ts          # `npm run scan` entry point
├── server/               # Headless REST API (Hono)
│   ├── app.ts            # Route registration
│   ├── db/               # Drizzle schema and connection
│   ├── routes/           # One file per resource, incl. health.ts
│   └── lib/              # AI diagnosis, capture processor, webhooks, sequence scheduler, channel adapters
├── api/[[...route]].ts   # Vercel serverless entry for the API
├── src/                  # React reference UI
│   ├── lib/adapters/     # CRM connectors for the health check
│   ├── lib/scoring/      # Platform-agnostic scoring engine
│   ├── lib/report/       # Client report (HTML) and evidence (JSON) export
│   ├── lib/api/          # Typed API client and in-memory mock
│   ├── hooks/            # Zustand stores
│   └── pages/            # Connect, Dashboard, Sales, Marketing, Service, Knowledge, Captures, Integrations
├── tests/                # node:test suites (scoring, process fit, scan, report)
└── docs/index.html       # Project site (GitHub Pages)
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Frontend (Vite, port 5173) and API (port 3001) together |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:api` | API server only, with watch |
| `npm run build` | Type-check and Vite production build |
| `npm run build:api` | Compile the API server |
| `npm run type-check` | `tsc --noEmit` (frontend) |
| `npm run type-check:api` | `tsc --noEmit` (server) |
| `npm run type-check:cli` | Type-check the CLI, Salesforce scan and tests |
| `npm run scan -- salesforce --target-org <alias>` | Read-only Salesforce health scan |
| `npm test` | Run the tests (`node:test`, no live org needed) |
| `npm run db:push` | Push the Drizzle schema to your database |
| `npm run db:generate` | Generate migration files |
| `npm run db:studio` | Open Drizzle Studio |

---

# Roadmap

Planned, not built yet:

- **Dynamics 365 depth:** data quality checks from Dataverse, admin last sign-in from Microsoft Graph, a full automation inventory, and process fit.
- **Salesforce in the app:** a server route and dashboard for the scan, data quality checks, Workflow Rules, MFA, and Service (Case) process fit.
- **More CRMs:** HubSpot next, then the other planned adapters.
- **Agent surface:** an MCP tool over the scan, reusing `core/`.
- **Scan history:** trend lines and side-by-side comparison across orgs.
- **Finish the previews:** Channel Capture, and CIM (Customer Intelligence) on top of it.

---

# Contributing

PRs welcome. Highest-value contributions right now:

1. **Dynamics 365 checks:** data quality and automation metrics that are "not measured" today
2. **Salesforce checks:** the "not measured yet" list above, in `core/salesforce/`
3. **HubSpot adapter:** enable it on the Connect page and fill `fetchHealthPayload`
4. **Zoho, SugarCRM, Pega, Freshsales, Pipedrive adapters:** manifests exist in `src/lib/adapters/index.ts`
5. **Scoring rules:** add rules to `src/lib/scoring/engine.ts`, with tests in `tests/`
6. **Sequence delivery:** email provider integrations for the sequence scheduler

Open an issue before starting anything large.

---

# License

MIT. Use it, fork it, build on it.

---

*Built by [@hareev](https://github.com/hareev)*
