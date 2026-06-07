# Login & Auth Configuration — Vytal on Vercel

A reference for how authentication is wired end-to-end, what environment
variables are required, and what to check when login/register fail on Vercel.

---

## How Login Works (End-to-End)

```
Browser (Login.tsx)
  → useAuthStore.login()
    → ApiClient.auth.login()           POST /api/auth/login
      → Vercel edge routes to:
        api/[[...route]].ts            (Hono/Vercel adapter)
          → server/app.ts             (Hono router)
            → server/routes/auth.ts   POST /login handler
              → Neon (DATABASE_URL)   SELECT user WHERE email = ?
              → bcryptjs.compare()    verify password hash
              → jose SignJWT          issue 30-day JWT
              ← { token, user, org }
  ← token stored in localStorage['vytal_token']
  → navigate('/app')
```

### Key files

| File | Role |
|---|---|
| `src/pages/Login.tsx` | Form UI; calls `useAuthStore.login()` on submit |
| `src/hooks/useAuthStore.ts` | Zustand store; calls `client.auth.login()`, saves token to localStorage |
| `src/lib/api/client.ts` | Typed `fetch` wrapper; builds the URL, attaches `Authorization` header |
| `api/[[...route]].ts` | Vercel serverless entry; wraps the Hono app via `hono/vercel` handle |
| `server/app.ts` | Hono app; mounts CORS middleware + all route groups |
| `server/routes/auth.ts` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| `server/middleware/auth.ts` | JWT verification (used on protected routes, NOT on login/register) |
| `server/db/index.ts` | Neon HTTP client + Drizzle ORM instance |

---

## API Routes

```
POST /api/auth/register   { orgName, email, name, password }
  → creates org + owner user, returns { token, user, org }

POST /api/auth/login      { email, password }
  → verifies credentials, returns { token, user, org }

GET  /api/auth/me         Authorization: Bearer <token>
  → returns { user, org } for the token owner
```

### Login handler logic (`server/routes/auth.ts`)

1. Validates request body with Zod (`email` + `password` fields)
2. Queries Neon: `SELECT * FROM users WHERE email = ?`
3. Runs `bcrypt.compare(password, user.password_hash)` — 401 on mismatch
4. Queries Neon: `SELECT * FROM organizations WHERE id = user.org_id`
5. Signs a JWT with `jose` (`HS256`, 30-day expiry) using `JWT_SECRET`
6. Returns `{ token, user, org }` — field names are camelCase mapped via `toUser()` / `toOrg()`

---

## API URL Resolution (`src/lib/api/client.ts`)

```typescript
const isLocalhost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

const VITE_API_URL =
  import.meta.env.VITE_API_URL          // build-time override (Vercel env var)
  || (isLocalhost
      ? 'http://localhost:3001/api'      // local dev: hit Node server directly
      : '/api')                          // production: relative path, same domain
```

In production on Vercel, if `VITE_API_URL` is not set, the client defaults
to `/api`. All API calls become `/api/auth/login`, `/api/contacts`, etc. —
same-origin, no CORS issue.

---

## Mock Mode

`useAuthStore.ts` checks `import.meta.env.VITE_USE_MOCK === 'true'` at
build time. When true:
- The store is pre-seeded with `DEMO_USER` + `DEMO_ORG` (Acme Corp)
- All calls go to `mockApi` in `src/lib/api/mock.ts` (in-memory)
- No backend or database needed
- **No real login/register** — anyone lands pre-authenticated

Ensure `VITE_USE_MOCK` is set to `false` (or unset) in Vercel for real auth.

---

## Required Environment Variables on Vercel

### Backend (Vercel Function)

These run server-side in `api/[[...route]].ts` and must be set in the
Vercel dashboard under **Settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon connection string, e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | **Yes** | Random string used to sign JWTs — `openssl rand -hex 32` |
| `CORS_ORIGIN` | Recommended | Set to your Vercel deployment URL, e.g. `https://vytal.vercel.app`. Defaults to `*` which works but is less secure |
| `ANTHROPIC_API_KEY` | Only for AI features | Used by Channel Capture processing |

### Frontend (Vite build)

These are baked into `dist/` at build time. Set under **Settings →
Environment Variables**, marked as "Available during Build":

| Variable | Required | Notes |
|---|---|---|
| `VITE_USE_MOCK` | **Yes** | Must be `false` for real auth; if missing it defaults to falsy (ok) |
| `VITE_API_URL` | No | Leave unset — the client auto-detects `/api` in production |
| `VITE_ANTHROPIC_API_KEY` | Only for AI health scan | Used client-side for Claude diagnosis |

---

## Neon Database Setup for Vercel

Neon works differently from standard Postgres — it uses **HTTP-based
serverless connections** via `@neondatabase/serverless`, which means:

- **No persistent connection pool** — safe for serverless (no pool exhaustion)
- **No IP allowlisting needed** — Neon accepts connections from Vercel's
  dynamic IPs by default
- **SSL is required** — the connection string must include `?sslmode=require`
  (Neon connection strings from the dashboard include this by default)

### Option A — Neon Vercel Integration (recommended, automatic)

1. Go to [vercel.com/integrations/neon](https://vercel.com/integrations/neon)
2. Click **Add Integration** and connect your Neon project
3. Neon automatically sets `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`) in
   your Vercel project for all environments (production, preview, development)
4. No manual copy-paste of connection strings needed; Vercel will
   re-deploy automatically when the integration is set up

### Option B — Manual (set env var yourself)

1. In Neon dashboard: **Connection Details → Connection string**
   (select your branch, e.g. `main`, and copy the full string)
2. In Vercel dashboard: **Settings → Environment Variables**
3. Add `DATABASE_URL` = `postgresql://<user>:<pass>@<host>/<db>?sslmode=require`
4. Apply to **Production**, **Preview**, and **Development**
5. Trigger a redeploy (new env vars do not apply to existing deployments)

### Run the schema migration

Before first login, the database tables must exist. After setting
`DATABASE_URL`, run locally:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

Or add it as a Vercel build step (not yet configured in the project).

---

## 405 Error on Login/Register — Possible Causes

A 405 ("Method Not Allowed") on `POST /api/auth/login` typically means
the request is hitting something that only accepts GET.

### Cause 1: Vercel SPA rewrite intercepting API POST calls

**Symptom:** `POST /api/auth/login` → 405  
**Cause:** The catch-all rewrite `/(.*) → /index.html` is being applied
before the serverless function route, so Vercel tries to serve the static
`index.html` for a POST request — static files only support GET.  
**Expected behaviour:** Vercel is supposed to route `/api/*` to
`api/[[...route]].ts` **before** applying rewrites. If this isn't happening,
the rewrite may need to explicitly exclude `/api`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Or use Vercel's `routes` array with explicit ordering instead of `rewrites`.

### Cause 2: Missing or wrong `DATABASE_URL`

**Symptom:** Server crashes on first DB call; Vercel may return 500 or
the function times out, which a misconfigured client could surface as 405.  
**Fix:** Confirm `DATABASE_URL` is set in Vercel and includes `?sslmode=require`.

### Cause 3: Missing `JWT_SECRET`

**Symptom:** `SignJWT` throws — `process.env.JWT_SECRET` is undefined —
the function errors out.  
**Fix:** Add `JWT_SECRET` to Vercel environment variables.

### Cause 4: `VITE_USE_MOCK=true` baked into production build

**Symptom:** Login page appears but never calls the API — mock user is
pre-loaded and form submission is intercepted by `mockApi`.  
**Fix:** Set `VITE_USE_MOCK=false` in Vercel's build environment variables
and redeploy.

### Cause 5: CORS preflight failing

**Symptom:** Browser console shows CORS error before 405; `OPTIONS`
request to `/api/auth/login` fails.  
**Cause:** `CORS_ORIGIN` is set to a value that doesn't match the
request's `Origin` header.  
**Fix:** Set `CORS_ORIGIN=*` temporarily to confirm, then restrict to the
exact Vercel URL (e.g. `https://vytal.vercel.app`).

---

## Quick Vercel Checklist

```
□ DATABASE_URL is set          (Neon connection string with ?sslmode=require)
□ JWT_SECRET is set            (any random string, ≥ 32 chars)
□ VITE_USE_MOCK = false        (or unset — must NOT be "true")
□ VITE_API_URL is unset        (let client auto-detect /api)
□ CORS_ORIGIN matches site URL (or * for now)
□ db:push has been run         (schema exists in Neon)
□ Redeployed after env changes (Vercel doesn't auto-redeploy on new env vars)
```
