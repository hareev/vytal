import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

  return c.json({ token, user: { ...user, password_hash: undefined }, org }, 201);
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

  const { password_hash: _ph, ...safeUser } = user;

  return c.json({ token, user: safeUser, org });
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

  const { password_hash: _ph, ...safeUser } = user;

  return c.json({ user: safeUser, org });
});

export default router;
