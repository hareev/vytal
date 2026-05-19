# Vytal — CLAUDE.md

## Project Overview

Vytal (v0.2.0) is a **headless CRM platform** with an integrated AI-powered health monitoring module. It is a full-stack application with a React SPA frontend and a REST API backend.

Target users: CRM architects, developers, and teams managing sales/marketing/service workflows.

**Modules:**
- **Health Doctor** — Connect a CRM org and get AI-powered health diagnostics (Dynamics 365 implemented; Salesforce/Siebel/HubSpot manifests exist, adapters not yet built)
- **Sales** — Kanban pipeline + contacts management
- **Marketing** — Campaigns, audience segments, automation sequences
- **Service** — Support ticket system with SLA tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3.1, TypeScript 5.5.3 (strict), Vite 5.3.4 |
| State | Zustand 4.5.4 (one store per module) |
| Charts | Recharts 2.12.7 |
| Routing | React Router v6 |
| Backend | Hono 4.5 on Node.js (`@hono/node-server`) |
| Database | Neon serverless PostgreSQL + Drizzle ORM |
| Auth | JWT (`jose`) + bcryptjs |
| Validation | Zod |
| AI | Claude API (Anthropic) |
| CRM API | Dataverse Web API OData v4 (D365) |
| Styling | Vanilla CSS with custom properties |

---

## Commands

```bash
npm install           # Install dependencies
npm run dev           # Frontend dev server → http://localhost:5173
npm run dev:api       # Backend dev server → http://localhost:3001 (tsx watch)
npm run dev:all       # Both servers concurrently
npm run build         # Type-check + production bundle (frontend)
npm run build:api     # Compile backend (tsconfig.server.json)
npm run preview       # Preview production build locally
npm run lint          # ESLint on .ts/.tsx files
npm run type-check    # Frontend tsc dry-run
npm run type-check:api # Backend tsc dry-run
npm run db:push       # Push schema to Neon (drizzle-kit push)
npm run db:generate   # Generate migration files
npm run db:studio     # Open Drizzle Studio
```

---

## Environment Setup

```bash
cp .env.example .env
```

**Frontend (`VITE_*`):**
- `VITE_ANTHROPIC_API_KEY` — Claude API key (required for Health Doctor)
- `VITE_API_URL` — Backend URL (default: `http://localhost:3001`)
- `VITE_USE_MOCK` — Use in-memory mock data instead of real backend (default: `true`)
- `VITE_CLAUDE_MODEL` — Override Claude model (optional)

**Backend:**
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — Random string for JWT signing
- `CORS_ORIGIN` — Allowed CORS origin (default: `*`)
- `PORT` — Server port (default: `3001`)

**Mock mode** (`VITE_USE_MOCK=true`): The frontend uses `src/lib/api/mock.ts` — a fully seeded in-memory store (15 contacts, 10 deals, 3 pipelines, 5 campaigns, 8 tickets, 2 sequences). No backend needed.

---

## Architecture

### Directory structure

```
vytal/
├── server/                          # Backend (Hono + Drizzle)
│   ├── index.ts                     # App entry: CORS, routing, error handling
│   ├── db/
│   │   ├── index.ts                 # Neon connection init
│   │   └── schema.ts                # 13-table Drizzle schema
│   ├── middleware/
│   │   └── auth.ts                  # JWT verification middleware
│   └── routes/
│       ├── auth.ts                  # POST /register, /login; GET /me
│       ├── contacts.ts              # CRUD + search + pagination
│       ├── deals.ts                 # CRUD + stage transitions
│       ├── pipelines.ts             # CRUD + stage management
│       ├── tickets.ts               # Support tickets + SLA
│       ├── campaigns.ts             # Email/SMS/push campaigns
│       ├── segments.ts              # Audience segmentation
│       └── orgs.ts                  # Org management + member invites
│
├── src/                             # Frontend (React + Vite)
│   ├── App.tsx                      # Root router (all routes)
│   ├── types/
│   │   ├── auth.ts                  # User, Org, UserRole, OrgPlan, AuthState
│   │   ├── crm.ts                   # Contact, Deal, Pipeline, Stage, Activity
│   │   ├── marketing.ts             # Campaign, Segment, Sequence, SequenceStep
│   │   ├── service.ts               # Ticket, TicketMessage, SLAPolicy
│   │   └── health.ts                # Health module domain types (unchanged)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts            # ApiClient class (typed fetch wrappers)
│   │   │   └── mock.ts              # In-memory mock API with seed data
│   │   ├── adapters/                # CRM health adapters (unchanged)
│   │   ├── scoring/engine.ts        # 5-dimension scoring engine (unchanged)
│   │   └── ai/triage.ts             # Claude API integration (unchanged)
│   ├── hooks/
│   │   ├── useAuthStore.ts          # login(), register(), logout(), loadFromStorage()
│   │   ├── useCrmStore.ts           # contacts, deals, pipelines CRUD
│   │   ├── useMarketingStore.ts     # campaigns, segments, sequences CRUD
│   │   ├── useServiceStore.ts       # tickets + messages CRUD
│   │   ├── useVytalStore.ts         # Health module state (unchanged)
│   │   └── useScan.ts               # Health scan orchestration (unchanged)
│   ├── pages/
│   │   ├── Login.tsx                # Email/password login
│   │   ├── Register.tsx             # Org creation + registration
│   │   ├── Settings.tsx             # Workspace settings, module toggles
│   │   ├── onboarding/Onboarding.tsx # 5-step onboarding wizard
│   │   ├── sales/
│   │   │   ├── Pipeline.tsx         # Drag-and-drop kanban board
│   │   │   └── Contacts.tsx         # Searchable contact table
│   │   ├── marketing/
│   │   │   └── Marketing.tsx        # Campaigns / Segments / Sequences tabs
│   │   ├── service/
│   │   │   └── Service.tsx          # Ticket list + SLA + conversation panel
│   │   ├── Connect.tsx              # CRM platform connector (health module)
│   │   └── Dashboard.tsx            # Health scoring dashboard
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx         # Sticky sidebar, org badge, user menu
│       │   └── Sidebar.tsx          # Module navigation
│       └── dashboard/               # Health dashboard panels (unchanged)
│
├── tsconfig.json                    # Frontend TS config (moduleResolution: bundler)
├── tsconfig.server.json             # Backend TS config (Node.js)
├── drizzle.config.ts                # Drizzle migration config
├── vite.config.ts                   # React plugin, @ path alias
└── .env.example                     # All env vars documented
```

### Route structure

```
/login, /register          → Public auth pages
/onboarding                → 5-step onboarding wizard
/app                       → Protected (requires JWT)
  /app/health/connect      → CRM platform connector
  /app/health              → AI health dashboard
  /app/sales               → Kanban pipeline
  /app/sales/contacts      → Contact table
  /app/marketing           → Campaigns/Segments/Sequences
  /app/service             → Support tickets
  /app/settings            → Workspace settings
```

### Health Doctor pipeline (unchanged from v0.1.0)

```
connect(platform, credentials)
    → createAdapter(platform)         # lib/adapters/index.ts
    → adapter.connect(credentials)    # OAuth2 / token exchange
    → adapter.fetchHealthPayload()    # parallel CRM API calls → RawHealthPayload
    → scoreHealthPayload(raw)         # lib/scoring/engine.ts → ScoredHealthPayload
    → generateDiagnosis(scored)       # lib/ai/triage.ts → AIDiagnosis (non-blocking)
```

---

## Key Patterns

### API client / mock toggle
`src/lib/api/client.ts` exports `ApiClient` with typed methods for all resources. `src/lib/api/mock.ts` mirrors the same interface in memory. The active implementation is selected at runtime via `VITE_USE_MOCK`.

### Zustand stores (one per module)
Each module has its own store: `useAuthStore`, `useCrmStore`, `useMarketingStore`, `useServiceStore`, `useVytalStore`. Stores call `ApiClient` methods and hold loading/error state.

### Database schema (13 tables)
Defined in `server/db/schema.ts` via Drizzle: `organizations`, `users`, `contacts`, `pipelines`, `pipeline_stages`, `deals`, `activities`, `segments`, `campaigns`, `sequences`, `sequence_steps`, `tickets`, `ticket_messages`.

### Adapter pattern (Health module)
All CRM connectors implement `BaseAdapter` (`src/lib/adapters/base.ts`). To add a new connector:
1. Create `src/lib/adapters/<platform>.ts` implementing `BaseAdapter`
2. Register in `src/lib/adapters/index.ts`

### Scoring engine (Health module)
Five dimensions scored 0–100 via penalty subtraction:

| Dimension | Weight | Key penalties |
|-----------|--------|--------------|
| Schema hygiene | 25% | custom entity ratio, naming violations |
| Automation complexity | 25% | circular deps, inactive flows, no error handling |
| Data quality | 20% | duplicate rate, incomplete required fields |
| Security | 20% | dormant admins, admin ratio, audit logging |
| Adoption | 10% | active user ratio, feature utilization |

---

## TypeScript Conventions

- **Strict mode** — `strict: true`, `noUnusedLocals`, `noUnusedParameters`
- **No `any`** — use proper types or `unknown` with type guards
- **Path alias** — `@/` maps to `src/` (frontend only; configured via `paths` in `tsconfig.json`)
- **Naming** — PascalCase for types/components, camelCase for functions/hooks, `use*` prefix for hooks
- Two tsconfig files: `tsconfig.json` (frontend, `moduleResolution: bundler`) and `tsconfig.server.json` (backend, Node.js)

---

## Roadmap (not yet implemented)

**D365 adapter gaps** (marked `// Phase 2` in `src/lib/adapters/d365.ts`):
- Circular dependency detection in flows
- Deprecated API call scanning
- Azure AD MFA check
- Audit log status check
- Feature utilization telemetry

**Planned CRM adapters:** Salesforce, Siebel, HubSpot
