# Vytal — Open-Source Headless CRM

> A fully-typed, API-first CRM platform with AI-powered health monitoring. Self-host it, extend it, or use it as the backend for any frontend.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![AI](https://img.shields.io/badge/AI-Claude%20API-orange)
![DB](https://img.shields.io/badge/database-Neon%20%2F%20Postgres-teal)

Vytal started as a CRM health monitor. It's now a complete open-source CRM platform: Sales pipeline, Marketing campaigns, Customer Service, and the original AI-powered Health Doctor — all backed by a headless REST API that any frontend can consume.

**No vendor lock-in. Your data stays in your own Neon database.**

---

## What's inside

| Module | Description |
|---|---|
| **Sales** | Contacts, drag-and-drop pipeline, deals, activities |
| **Marketing** | Email/SMS/push campaigns, audience segments, automation sequences |
| **Service** | Support tickets, SLA tracking, internal notes, conversation threads |
| **Health Monitor** | AI health scoring across schema, automation, data quality, security, and adoption |
| **Headless API** | Full REST API (Hono) — consume from any frontend, mobile app, or integration |

---

## Quick start

### Option 1 — Mock mode (no backend required)

```bash
git clone https://github.com/hareev/vytal.git
cd vytal
npm install
cp .env.example .env          # VITE_USE_MOCK=true is already set
npm run dev
```

Open `http://localhost:5173`. You'll land on a pre-loaded workspace (Acme Corp) with 15 contacts, 10 deals, 5 campaigns, 8 tickets, and 2 sequences — all running in-memory.

### Option 2 — Full stack with Neon

```bash
# 1. Create a Neon project at neon.tech, copy the connection string
# 2. Configure .env
cp .env.example .env
# Fill in:
#   VITE_ANTHROPIC_API_KEY=sk-ant-...
#   VITE_USE_MOCK=false
#   VITE_API_URL=http://localhost:3001
#   DATABASE_URL=postgresql://...
#   JWT_SECRET=$(openssl rand -hex 32)

# 3. Push the schema to your database
npm run db:push

# 4. Run frontend + API together
npm run dev:all
```

---

## Environment variables

### Frontend (`VITE_*`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | For AI diagnosis | — | Anthropic API key |
| `VITE_USE_MOCK` | No | `true` | Run without a backend using in-memory data |
| `VITE_API_URL` | No | `http://localhost:3001` | API server URL |
| `VITE_CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Override the Claude model |

### API server

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (real mode) | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes (real mode) | Random string for signing JWTs (`openssl rand -hex 32`) |
| `PORT` | No | API server port (default: `3001`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `*`) |

---

## Architecture

```
vytal/
├── server/                        # Headless REST API
│   ├── db/
│   │   ├── schema.ts              # Drizzle ORM schema (13 tables)
│   │   └── index.ts               # Neon connection
│   ├── middleware/
│   │   └── auth.ts                # JWT verification
│   └── routes/
│       ├── auth.ts                # POST /register, /login, GET /me
│       ├── contacts.ts            # CRUD + search + pagination
│       ├── deals.ts               # CRUD + pipeline stage moves
│       ├── pipelines.ts           # Pipelines + stages
│       ├── campaigns.ts           # CRUD
│       ├── segments.ts            # CRUD + filter storage
│       ├── tickets.ts             # CRUD + messages + auto SLA
│       └── orgs.ts                # Org stats + member management
│
└── src/                           # React frontend (reference UI)
    ├── types/
    │   ├── auth.ts                # User, Org, UserRole, OrgPlan
    │   ├── crm.ts                 # Contact, Deal, Pipeline, Stage, Activity
    │   ├── marketing.ts           # Campaign, Segment, Sequence
    │   ├── service.ts             # Ticket, TicketMessage, SLAPolicy
    │   └── health.ts              # RawHealthPayload, ScoredHealthPayload, Issue
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts          # Typed API client (fetch-based)
    │   │   └── mock.ts            # In-memory mock with seed data
    │   ├── adapters/              # CRM connectors (health module)
    │   │   ├── base.ts            # BaseAdapter interface
    │   │   ├── d365.ts            # Dynamics 365 / Dataverse
    │   │   └── index.ts           # Registry + factory
    │   ├── scoring/
    │   │   └── engine.ts          # Platform-agnostic health scoring
    │   └── ai/
    │       └── triage.ts          # Claude API → structured diagnosis
    ├── hooks/
    │   ├── useAuthStore.ts        # Login, register, logout, session restore
    │   ├── useCrmStore.ts         # Contacts, deals, pipelines, activities
    │   ├── useMarketingStore.ts   # Campaigns, segments, sequences
    │   ├── useServiceStore.ts     # Tickets + messages
    │   └── useVytalStore.ts       # Health monitor state
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx       # Sidebar + outlet layout
    │   │   └── Sidebar.tsx        # Module nav, org badge, user menu
    │   └── dashboard/             # Health module panels
    └── pages/
        ├── Login.tsx
        ├── Register.tsx
        ├── Settings.tsx
        ├── onboarding/
        │   └── Onboarding.tsx     # 5-step setup wizard
        ├── sales/
        │   ├── Pipeline.tsx       # Drag-and-drop kanban board
        │   └── Contacts.tsx       # Table + detail side-panel
        ├── marketing/
        │   └── Marketing.tsx      # Campaigns / Segments / Sequences tabs
        ├── service/
        │   └── Service.tsx        # Ticket queue + SLA panel
        ├── Connect.tsx            # CRM health connector
        └── Dashboard.tsx          # Health score dashboard
```

---

## API reference

The API server runs on port 3001 and is consumed by the frontend via the Vite proxy (`/api → localhost:3001`). Every resource is scoped to the authenticated organisation.

### Auth

```
POST /api/auth/register   { orgName, email, name, password }
POST /api/auth/login      { email, password }
GET  /api/auth/me
```

### Core resources

All endpoints require `Authorization: Bearer <token>`.

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

GET    /api/campaigns
POST   /api/campaigns
PATCH  /api/campaigns/:id
DELETE /api/campaigns/:id

GET    /api/segments
POST   /api/segments
PATCH  /api/segments/:id
DELETE /api/segments/:id

GET    /api/tickets            ?status=&priority=&assignee_id=
POST   /api/tickets            (auto-sets sla_due_at by priority)
PATCH  /api/tickets/:id
POST   /api/tickets/:id/messages

GET    /api/orgs               (org + aggregate stats)
PATCH  /api/orgs
GET    /api/orgs/members
POST   /api/orgs/members/invite
```

---

## Database schema

13 Postgres tables managed with Drizzle ORM:

`organizations` → `users` → `contacts` / `deals` / `activities` / `tickets` / `ticket_messages` / `pipelines` → `pipeline_stages` / `segments` / `campaigns` / `sequences` → `sequence_steps`

All tables include `org_id` for multi-tenancy. Run `npm run db:studio` to browse data via Drizzle Studio.

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Frontend only (Vite, port 5173) |
| `npm run dev:api` | API server only (tsx watch, port 3001) |
| `npm run dev:all` | Both in parallel |
| `npm run build` | Type-check + Vite production build |
| `npm run type-check` | `tsc --noEmit` (frontend) |
| `npm run type-check:api` | `tsc --noEmit` (server) |
| `npm run db:push` | Push Drizzle schema to Neon |
| `npm run db:generate` | Generate migration files |
| `npm run db:studio` | Open Drizzle Studio |

---

## Health Monitor — CRM connector module

The original Vytal capability: connect an external CRM, score its health, and get Claude-powered recommendations.

### Supported platforms

| Platform | Status |
|---|---|
| Dynamics 365 / Dataverse | ✅ Implemented |
| Salesforce | 🔜 Planned |
| Oracle Siebel | 🔜 Planned |
| HubSpot | 📋 Planned |

### Health dimensions

| Dimension | Weight | Measures |
|---|---|---|
| Schema hygiene | 25% | Unused fields/entities, naming violations, deprecated objects |
| Automation complexity | 25% | Circular dependencies, nesting depth, missing error handling |
| Data quality | 20% | Duplicates, incomplete required fields, stale records |
| Security posture | 20% | Over-privileged roles, dormant admins, audit log gaps |
| Adoption health | 10% | Active user ratios, feature utilisation |

### Adding a new CRM connector

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

Then register it in `src/lib/adapters/index.ts`. The scoring engine and AI layer are fully platform-agnostic.

---

## Contributing

PRs welcome. Highest-value contributions right now:

1. **Salesforce adapter** — REST + Tooling API, map to `RawHealthPayload`
2. **HubSpot adapter** — Private App Token auth, object + engagement APIs
3. **Scoring rules** — add rules to `src/lib/scoring/engine.ts`
4. **Sequence engine** — backend scheduler for drip campaign delivery
5. **Knowledge base module** — articles, categories, public customer portal

Open an issue before starting anything large.

---

## License

MIT — use it, fork it, build on it.

---

*Built by [@hareev](https://github.com/hareev)*
