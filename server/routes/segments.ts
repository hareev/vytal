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
const createSegmentSchema = z.object({
  name: z.string().min(1),
  filters: z.record(z.unknown()),
  contact_count: z.number().int().nonnegative().optional(),
});

const updateSegmentSchema = createSegmentSchema.partial();

// ---------------------------------------------------------------------------
// GET /segments
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const rows = await db
    .select()
    .from(schema.segments)
    .where(eq(schema.segments.org_id, auth.orgId))
    .orderBy(desc(schema.segments.created_at));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /segments
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createSegmentSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [segment] = await db
    .insert(schema.segments)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json(segment, 201);
});

// ---------------------------------------------------------------------------
// PATCH /segments/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateSegmentSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.segments)
    .where(and(eq(schema.segments.id, id), eq(schema.segments.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Segment not found' }, 404);
  }

  const [segment] = await db
    .update(schema.segments)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(schema.segments.id, id), eq(schema.segments.org_id, auth.orgId)))
    .returning();

  return c.json(segment);
});

// ---------------------------------------------------------------------------
// DELETE /segments/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.segments)
    .where(and(eq(schema.segments.id, id), eq(schema.segments.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Segment not found' }, 404);
  }

  await db
    .delete(schema.segments)
    .where(and(eq(schema.segments.id, id), eq(schema.segments.org_id, auth.orgId)));

  return c.json({ success: true });
});

export default router;
