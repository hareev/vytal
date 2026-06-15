import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

// ─── DB row → frontend shape ──────────────────────────────────────────────────

type DbUser = typeof schema.users.$inferSelect;
type DbOrg = typeof schema.organizations.$inferSelect;

function toUser(u: DbUser) {
  return { id: u.id, orgId: u.org_id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at };
}

function toOrg(o: DbOrg) {
  return { id: o.id, name: o.name, slug: o.slug, plan: o.plan, modules: o.modules, createdAt: o.created_at };
}

const router = new Hono();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3001';
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const entry = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

async function findOrCreateOAuthUser(
  provider: string,
  providerId: string,
  email: string,
  name: string,
): Promise<{ user: typeof schema.users.$inferSelect; org: typeof schema.organizations.$inferSelect }> {
  // Returning OAuth user — matched by provider + provider_id
  const [byProvider] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.provider, provider), eq(schema.users.provider_id, providerId)))
    .limit(1);

  if (byProvider) {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, byProvider.org_id))
      .limit(1);
    return { user: byProvider, org };
  }

  // Email already exists — link OAuth to existing account
  const [byEmail] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (byEmail) {
    await db
      .update(schema.users)
      .set({ provider, provider_id: providerId })
      .where(eq(schema.users.id, byEmail.id));
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, byEmail.org_id))
      .limit(1);
    return { user: byEmail, org };
  }

  // New user — create org + owner
  const baseSlug = slugify(name) || 'workspace';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: `${name}'s Workspace`, slug })
    .returning();
  const [user] = await db
    .insert(schema.users)
    .values({ org_id: org.id, email, name, role: 'owner', provider, provider_id: providerId })
    .returning();
  return { user, org };
}
async function signToken(payload: {
  userId: string;
  orgId: string;
  role: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  orgName: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

router.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');

  // Check if email already exists
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const password_hash = await bcrypt.hash(body.password, 12);
  const slug = slugify(body.orgName);

  // Create org
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: body.orgName, slug })
    .returning();

  // Create owner user
  const [user] = await db
    .insert(schema.users)
    .values({
      org_id: org.id,
      email: body.email,
      name: body.name,
      role: 'owner',
      password_hash,
    })
    .returning();

  const token = await signToken({
    userId: user.id,
    orgId: org.id,
    role: user.role,
  });

  return c.json({ token, user: toUser(user), org: toOrg(org) }, 201);
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json');

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (!user.password_hash) {
    return c.json({ error: 'This account uses social sign-in. Please sign in with GitHub or Google.' }, 400);
  }

  const valid = await bcrypt.compare(body.password, user.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, user.org_id))
    .limit(1);

  const token = await signToken({
    userId: user.id,
    orgId: user.org_id,
    role: user.role,
  });

  return c.json({ token, user: toUser(user), org: toOrg(org) });
});

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------
router.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, auth.userId))
    .limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, auth.orgId))
    .limit(1);

  return c.json({ user: toUser(user), org: toOrg(org) });
});

// ---------------------------------------------------------------------------
// GitHub OAuth
// ---------------------------------------------------------------------------
router.get('/github', async (c) => {
  const state = crypto.randomUUID();
  const appUrl = getAppUrl();
  const redirectUri = `${appUrl}/api/auth/github/callback`;
  console.log('[github] initiating OAuth — APP_URL:', appUrl, '| redirect_uri:', redirectUri, '| client_id set:', !!process.env.GITHUB_CLIENT_ID);
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    scope: 'user:email',
    state,
  });
  c.header(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
  );
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/github/callback', async (c) => {
  const { code, state, error: ghError } = c.req.query();
  const cookieState = getCookieValue(c.req.header('cookie') ?? '', 'oauth_state');
  console.log('[github/callback] code:', !!code, '| state match:', state === cookieState, '| gh error:', ghError ?? 'none');

  if (ghError) {
    console.error('[github/callback] GitHub returned error:', ghError);
    return c.redirect(`${getAppUrl()}/login?error=github_denied`);
  }

  if (!code || !state || state !== cookieState) {
    console.error('[github/callback] state mismatch — got:', state, '| cookie:', cookieState);
    return c.redirect(`${getAppUrl()}/login?error=invalid_state`);
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
  console.log('[github/callback] token exchange — has access_token:', !!tokenData.access_token, '| error:', tokenData.error ?? 'none', tokenData.error_description ?? '');

  if (!tokenData.access_token) {
    return c.redirect(`${getAppUrl()}/login?error=github_token_failed`);
  }

  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Vytal' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Vytal' },
    }),
  ]);
  const ghUser = await userRes.json() as { id: number; name?: string; login?: string; email?: string };
  const ghEmails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];
  console.log('[github/callback] gh user id:', ghUser.id, '| login:', ghUser.login, '| emails count:', ghEmails.length);

  const email = ghEmails.find(e => e.primary && e.verified)?.email ?? ghUser.email ?? '';
  if (!email) {
    console.error('[github/callback] no verified primary email found');
    return c.redirect(`${getAppUrl()}/login?error=no_email`);
  }

  const name = ghUser.name ?? ghUser.login ?? 'GitHub User';
  console.log('[github/callback] upserting user — email:', email, '| name:', name);

  try {
    const { user, org } = await findOrCreateOAuthUser('github', String(ghUser.id), email, name);
    console.log('[github/callback] user upserted — userId:', user.id, '| orgId:', org.id);
    const token = await signToken({ userId: user.id, orgId: org.id, role: user.role });
    c.header('Set-Cookie', 'oauth_state=; HttpOnly; Path=/; Max-Age=0');
    const dest = `${getAppUrl()}/auth/callback?token=${token}`;
    console.log('[github/callback] redirecting to:', dest.replace(/token=.*/, 'token=<redacted>'));
    return c.redirect(dest);
  } catch (err) {
    console.error('[github/callback] DB error:', err);
    return c.redirect(`${getAppUrl()}/login?error=db_error`);
  }
});

export default router;
