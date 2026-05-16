import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createDealSchema = z.object({
  title: z.string().min(1),
  value: z.string().optional(),
  currency: z.string().optional(),
  stage_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  contact_id: z.string().uuid().optional(),
  owner_id: z.string().uuid().optional(),
  close_date: z.string().optional(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  notes: z.string().optional(),
});

const updateDealSchema = createDealSchema.partial();

// ---------------------------------------------------------------------------
// GET /deals
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');
  const { pipeline_id, stage_id, status } = c.req.query();

  const conditions = [eq(schema.deals.org_id, auth.orgId)];

  if (pipeline_id) {
    conditions.push(eq(schema.deals.pipeline_id, pipeline_id));
  }

  if (stage_id) {
    conditions.push(eq(schema.deals.stage_id, stage_id));
  }

  if (status) {
    conditions.push(eq(schema.deals.status, status as 'open' | 'won' | 'lost'));
  }

  const rows = await db
    .select()
    .from(schema.deals)
    .where(and(...conditions))
    .orderBy(desc(schema.deals.created_at));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /deals
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createDealSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [deal] = await db
    .insert(schema.deals)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json(deal, 201);
});

// ---------------------------------------------------------------------------
// GET /deals/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(and(eq(schema.deals.id, id), eq(schema.deals.org_id, auth.orgId)))
    .limit(1);

  if (!deal) {
    return c.json({ error: 'Deal not found' }, 404);
  }

  return c.json(deal);
});

// ---------------------------------------------------------------------------
// PATCH /deals/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateDealSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.deals)
    .where(and(eq(schema.deals.id, id), eq(schema.deals.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Deal not found' }, 404);
  }

  const [deal] = await db
    .update(schema.deals)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(schema.deals.id, id), eq(schema.deals.org_id, auth.orgId)))
    .returning();

  return c.json(deal);
});

// ---------------------------------------------------------------------------
// DELETE /deals/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.deals)
    .where(and(eq(schema.deals.id, id), eq(schema.deals.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Deal not found' }, 404);
  }

  await db
    .delete(schema.deals)
    .where(and(eq(schema.deals.id, id), eq(schema.deals.org_id, auth.orgId)));

  return c.json({ success: true });
});

export default router;
