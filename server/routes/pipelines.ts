import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createPipelineSchema = z.object({
  name: z.string().min(1),
  is_default: z.boolean().optional(),
});

const createStageSchema = z.object({
  name: z.string().min(1),
  position: z.number().int().nonnegative(),
  probability: z.number().int().min(0).max(100).optional(),
});

const updateStageSchema = createStageSchema.partial();

// ---------------------------------------------------------------------------
// GET /pipelines — list with stages embedded
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const pipelineRows = await db
    .select()
    .from(schema.pipelines)
    .where(eq(schema.pipelines.org_id, auth.orgId));

  if (pipelineRows.length === 0) {
    return c.json({ data: [] });
  }

  const pipelineIds = pipelineRows.map((p) => p.id);

  const stageRows = await db
    .select()
    .from(schema.pipeline_stages)
    .where(inArray(schema.pipeline_stages.pipeline_id, pipelineIds))
    .orderBy(asc(schema.pipeline_stages.position));

  const stagesByPipeline: Record<string, typeof stageRows> = {};
  for (const stage of stageRows) {
    if (!stagesByPipeline[stage.pipeline_id]) {
      stagesByPipeline[stage.pipeline_id] = [];
    }
    stagesByPipeline[stage.pipeline_id].push(stage);
  }

  const data = pipelineRows.map((p) => ({
    ...p,
    stages: stagesByPipeline[p.id] ?? [],
  }));

  return c.json({ data });
});

// ---------------------------------------------------------------------------
// POST /pipelines
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createPipelineSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [pipeline] = await db
    .insert(schema.pipelines)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json({ ...pipeline, stages: [] }, 201);
});

// ---------------------------------------------------------------------------
// POST /pipelines/:id/stages
// ---------------------------------------------------------------------------
router.post('/:id/stages', zValidator('json', createStageSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [pipeline] = await db
    .select()
    .from(schema.pipelines)
    .where(and(eq(schema.pipelines.id, id), eq(schema.pipelines.org_id, auth.orgId)))
    .limit(1);

  if (!pipeline) {
    return c.json({ error: 'Pipeline not found' }, 404);
  }

  const [stage] = await db
    .insert(schema.pipeline_stages)
    .values({ ...body, pipeline_id: id })
    .returning();

  return c.json(stage, 201);
});

// ---------------------------------------------------------------------------
// PATCH /pipelines/:id/stages/:stageId
// ---------------------------------------------------------------------------
router.patch('/:id/stages/:stageId', zValidator('json', updateStageSchema), async (c) => {
  const auth = c.get('auth');
  const { id, stageId } = c.req.param();
  const body = c.req.valid('json');

  const [pipeline] = await db
    .select()
    .from(schema.pipelines)
    .where(and(eq(schema.pipelines.id, id), eq(schema.pipelines.org_id, auth.orgId)))
    .limit(1);

  if (!pipeline) {
    return c.json({ error: 'Pipeline not found' }, 404);
  }

  const [existing] = await db
    .select()
    .from(schema.pipeline_stages)
    .where(
      and(eq(schema.pipeline_stages.id, stageId), eq(schema.pipeline_stages.pipeline_id, id)),
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Stage not found' }, 404);
  }

  const [stage] = await db
    .update(schema.pipeline_stages)
    .set(body)
    .where(
      and(eq(schema.pipeline_stages.id, stageId), eq(schema.pipeline_stages.pipeline_id, id)),
    )
    .returning();

  return c.json(stage);
});

export default router;
