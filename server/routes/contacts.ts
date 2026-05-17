import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createContactSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(['lead', 'prospect', 'customer', 'churned']).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  owner_id: z.string().uuid().optional(),
});

const updateContactSchema = createContactSchema.partial();

// ---------------------------------------------------------------------------
// GET /contacts
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');
  const { search, status, page, limit } = c.req.query();

  const pageNum = Math.max(1, parseInt(page ?? '1', 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(schema.contacts.org_id, auth.orgId)];

  if (status) {
    conditions.push(
      eq(schema.contacts.status, status as 'lead' | 'prospect' | 'customer' | 'churned'),
    );
  }

  if (search) {
    conditions.push(
      sql`(${schema.contacts.first_name} ILIKE ${'%' + search + '%'} OR ${schema.contacts.last_name} ILIKE ${'%' + search + '%'} OR ${schema.contacts.email} ILIKE ${'%' + search + '%'})`,
    );
  }

  const rows = await db
    .select()
    .from(schema.contacts)
    .where(and(...conditions))
    .orderBy(desc(schema.contacts.created_at))
    .limit(limitNum)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.contacts)
    .where(and(...conditions));

  return c.json({ data: rows, meta: { page: pageNum, limit: limitNum, total: count } });
});

// ---------------------------------------------------------------------------
// POST /contacts
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createContactSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [contact] = await db
    .insert(schema.contacts)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json(contact, 201);
});

// ---------------------------------------------------------------------------
// GET /contacts/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.org_id, auth.orgId)))
    .limit(1);

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  return c.json(contact);
});

// ---------------------------------------------------------------------------
// PATCH /contacts/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateContactSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  const [contact] = await db
    .update(schema.contacts)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.org_id, auth.orgId)))
    .returning();

  return c.json(contact);
});

// ---------------------------------------------------------------------------
// DELETE /contacts/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  await db
    .delete(schema.contacts)
    .where(and(eq(schema.contacts.id, id), eq(schema.contacts.org_id, auth.orgId)));

  return c.json({ success: true });
});

export default router;
