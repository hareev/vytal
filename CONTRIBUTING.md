# Contributing to Vytal

Thank you for helping build Vytal. This guide covers everything you need to make a successful contribution.

---

## Before you start

- For bug fixes and small improvements, open a PR directly.
- For new features or architectural changes, **open an issue first** so we can align before you invest the time.
- Check open issues and PRs to avoid duplicating work.

All contributions must pass `npm run type-check` (zero errors) and follow the code style guidelines below.

---

## Development setup

```bash
git clone https://github.com/hareev/vytal.git
cd vytal
npm install
cp .env.example .env        # set VITE_USE_MOCK=true for zero-backend dev
npm run dev                  # frontend on http://localhost:5173
```

To work with the API server and a real database:

```bash
# Set DATABASE_URL and JWT_SECRET in .env, then:
npm run db:push              # push schema to Neon
npm run dev:all              # frontend + API in parallel
```

---

## What we need most

### 1. CRM health adapters

Each adapter maps a CRM platform's native APIs to the shared `RawHealthPayload` type.

1. Create `src/lib/adapters/yourplatform.ts`
2. Implement `BaseAdapter` from `src/lib/adapters/base.ts`
3. Add a `static manifest: AdapterManifest` (defines the connect form fields)
4. Register it in `src/lib/adapters/index.ts` — add to `ADAPTER_MANIFESTS` and the `createAdapter` factory

```typescript
// Minimal adapter skeleton
import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection, RawHealthPayload } from '@/types/health'

export class MyAdapter implements BaseAdapter {
  readonly name = 'My CRM'
  readonly platform = 'custom' as const   // or add to CRMPlatform union

  static manifest: AdapterManifest = {
    platform: 'custom',
    name: 'My CRM',
    credentialFields: [
      { key: 'apiUrl', label: 'API URL', type: 'url', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  }

  async connect(credentials: Record<string, string>): Promise<OrgConnection> { ... }
  async validateConnection(): Promise<boolean> { ... }
  async fetchHealthPayload(): Promise<RawHealthPayload> { ... }
}
```

Priority targets: **Salesforce**, **HubSpot**.

### 2. Scoring rules

Rules live in `src/lib/scoring/engine.ts` inside per-dimension functions (`scoreSchema`, `scoreAutomation`, etc.).

A rule:
- Fires against `RawHealthPayload`
- Produces an `Issue` via the `issue()` helper
- Adds a numeric `penalty` (proportional to real-world impact)

Penalty guidelines:

| Severity | Penalty range |
|---|---|
| `critical` | 15 – 25 |
| `high` | 10 – 15 |
| `medium` | 5 – 10 |
| `low` | 1 – 5 |

### 3. API routes

New endpoints go in `server/routes/`. Follow the existing pattern:

- Use Hono's `zod-validator` middleware for request body validation
- Scope all queries to `auth.orgId` from the auth middleware
- Return consistent JSON shapes (`{ data }` for single items, plain arrays for lists)
- Handle `404` and propagate errors to the global error handler (don't swallow)

### 4. Frontend modules

New pages go in `src/pages/<module>/`. Follow the existing conventions:

- Inline styles using CSS custom properties (`var(--bg-card)`, `var(--accent)`, etc.)
- Named exports (no default exports from component files)
- `import type { ReactNode } from 'react'` — never `React.ReactNode` without an import
- `useEffect(() => { loadX() }, [])` for data loading on mount
- Empty states with a descriptive icon, message, and CTA button
- Fixed overlay modals with click-outside-to-close (`if (e.target === e.currentTarget) onClose()`)
- No `any`, no `@ts-ignore`

---

## Code style

- **TypeScript strict mode** — `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` are all on
- **No CSS frameworks** — inline styles only, CSS custom properties for theming
- **No default exports** from component files; use named exports
- **No comments explaining what the code does** — only comments explaining *why* (hidden constraints, workarounds, non-obvious invariants)
- **No backwards-compat shims** — if something is unused, delete it

---

## Pull request checklist

Before submitting:

- [ ] `npm run type-check` passes with zero errors
- [ ] New files are in the correct directory (see architecture in README)
- [ ] No `any` types or `@ts-ignore` suppressions
- [ ] Mock data updated if you added a new entity type (`src/lib/api/mock.ts`)
- [ ] `CHANGELOG.md` updated under `[Unreleased]` with a brief description
- [ ] PR description explains *why* the change is needed, not just what it does

---

## Reporting bugs

Open a GitHub issue and include:

- The platform / CRM adapter involved (if applicable)
- What you expected to happen
- What actually happened
- Steps to reproduce
- Any relevant error messages from the console

---

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
