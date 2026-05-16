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
const createCampaignSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'sms', 'push']),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused']).optional(),
  segment_id: z.string().uuid().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  scheduled_at: z.string().datetime().optional(),
  stats: z
    .object({
      sent: z.number().int().optional(),
      opened: z.number().int().optional(),
      clicked: z.number().int().optional(),
      bounced: z.number().int().optional(),
    })
    .optional(),
});

const updateCampaignSchema = createCampaignSchema.partial();

// ---------------------------------------------------------------------------
// GET /campaigns
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const rows = await db
    .select()
    .from(schema.campaigns)
    .where(eq(schema.campaigns.org_id, auth.orgId))
    .orderBy(desc(schema.campaigns.created_at));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /campaigns
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createCampaignSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json(campaign, 201);
});

// ---------------------------------------------------------------------------
// GET /campaigns/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [campaign] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.org_id, auth.orgId)))
    .limit(1);

  if (!campaign) {
    return c.json({ error: 'Campaign not found' }, 404);
  }

  return c.json(campaign);
});

// ---------------------------------------------------------------------------
// PATCH /campaigns/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateCampaignSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Campaign not found' }, 404);
  }

  const [campaign] = await db
    .update(schema.campaigns)
    .set({ ...body, updated_at: new Date() })
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.org_id, auth.orgId)))
    .returning();

  return c.json(campaign);
});

// ---------------------------------------------------------------------------
// DELETE /campaigns/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Campaign not found' }, 404);
  }

  await db
    .delete(schema.campaigns)
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.org_id, auth.orgId)));

  return c.json({ success: true });
});

export default router;
