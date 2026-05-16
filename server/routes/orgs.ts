import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'member']).optional(),
  temp_password: z.string().min(8),
});

// ---------------------------------------------------------------------------
// GET / — current org + stats
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, auth.orgId))
    .limit(1);

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  const [contactStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.contacts)
    .where(eq(schema.contacts.org_id, auth.orgId));

  const [dealStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.deals)
    .where(eq(schema.deals.org_id, auth.orgId));

  const [ticketStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tickets)
    .where(eq(schema.tickets.org_id, auth.orgId));

  const [openDealValue] = await db
    .select({ total: sql<string>`coalesce(sum(value), 0)::text` })
    .from(schema.deals)
    .where(and(eq(schema.deals.org_id, auth.orgId), eq(schema.deals.status, 'open')));

  return c.json({
    org,
    stats: {
      contact_count: contactStats.count,
      deal_count: dealStats.count,
      ticket_count: ticketStats.count,
      open_deal_value: openDealValue.total,
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH / — update org name/slug
// ---------------------------------------------------------------------------
router.patch('/', zValidator('json', updateOrgSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [org] = await db
    .update(schema.organizations)
    .set(body)
    .where(eq(schema.organizations.id, auth.orgId))
    .returning();

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  return c.json(org);
});

// ---------------------------------------------------------------------------
// GET /members — list users in org
// ---------------------------------------------------------------------------
router.get('/members', async (c) => {
  const auth = c.get('auth');

  const rows = await db
    .select({
      id: schema.users.id,
      org_id: schema.users.org_id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      created_at: schema.users.created_at,
    })
    .from(schema.users)
    .where(eq(schema.users.org_id, auth.orgId));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /members/invite — create user with temp password
// ---------------------------------------------------------------------------
router.post('/members/invite', zValidator('json', inviteMemberSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  // Only owners and admins can invite
  if (auth.role === 'member') {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const password_hash = await bcrypt.hash(body.temp_password, 12);

  const [user] = await db
    .insert(schema.users)
    .values({
      org_id: auth.orgId,
      email: body.email,
      name: body.name,
      role: body.role ?? 'member',
      password_hash,
    })
    .returning({
      id: schema.users.id,
      org_id: schema.users.org_id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      created_at: schema.users.created_at,
    });

  return c.json(user, 201);
});

export default router;
