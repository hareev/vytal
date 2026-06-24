import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, desc, and, count } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { analyzeCrm } from '../lib/crmAnalyzer.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createSchema = z
  .object({
    crmName: z.string().min(1).max(120),
    repoUrl: z.string().url().optional(),
    appUrl: z.string().url().optional(),
    description: z.string().min(10).max(2000),
    builtFor: z.string().max(1000).optional(),
  })
  .refine((d) => d.repoUrl || d.appUrl, {
    message: 'At least one of repoUrl or appUrl is required',
  });

// ---------------------------------------------------------------------------
// Async analysis runner (fire-and-forget)
// ---------------------------------------------------------------------------

async function runAnalysis(
  submissionId: string,
  repoUrl: string | null,
  appUrl: string | null,
  description: string,
  builtFor: string | null,
): Promise<void> {
  try {
    const report = await analyzeCrm(repoUrl, appUrl, description, builtFor);
    await db
      .update(schema.crm_submissions)
      .set({
        status: 'completed',
        verdict: report.verdict,
        score: report.score,
        ai_report: report as unknown as Record<string, unknown>,
        updated_at: new Date(),
      })
      .where(eq(schema.crm_submissions.id, submissionId));
  } catch (err) {
    await db
      .update(schema.crm_submissions)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Analysis failed',
        updated_at: new Date(),
      })
      .where(eq(schema.crm_submissions.id, submissionId));
  }
}

// ---------------------------------------------------------------------------
// GET /api/crm-reviews — community directory (cross-org)
// ---------------------------------------------------------------------------

router.get('/', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '30', 10), 100);
  const verdict = c.req.query('verdict');
  const offset = (page - 1) * limit;

  const conditions = [];
  if (verdict) {
    conditions.push(
      eq(schema.crm_submissions.verdict, verdict as 'looks_good' | 'needs_improvement' | 'not_a_crm'),
    );
  }

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(schema.crm_submissions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.crm_submissions.created_at))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(schema.crm_submissions)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return c.json({
    data: rows,
    meta: { page, limit, total: Number(totalRow?.count ?? 0) },
  });
});

// ---------------------------------------------------------------------------
// POST /api/crm-reviews — submit a CRM for validation
// ---------------------------------------------------------------------------

router.post('/', zValidator('json', createSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  // Fetch submitter name for display in directory
  const [userRow] = await db
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, auth.userId))
    .limit(1);

  const [submission] = await db
    .insert(schema.crm_submissions)
    .values({
      user_id: auth.userId,
      org_id: auth.orgId,
      submitter_name: userRow?.name ?? null,
      crm_name: body.crmName,
      repo_url: body.repoUrl ?? null,
      app_url: body.appUrl ?? null,
      description: body.description,
      built_for: body.builtFor ?? null,
      status: 'analyzing',
    })
    .returning();

  // Fire-and-forget analysis
  if (process.env.ANTHROPIC_API_KEY) {
    runAnalysis(
      submission.id,
      submission.repo_url,
      submission.app_url,
      submission.description,
      submission.built_for,
    ).catch((err) => console.error('CRM analysis failed', submission.id, err));
  }

  return c.json(submission, 201);
});

// ---------------------------------------------------------------------------
// GET /api/crm-reviews/:id — single submission (visible to any logged-in user)
// ---------------------------------------------------------------------------

router.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(schema.crm_submissions)
    .where(eq(schema.crm_submissions.id, id))
    .limit(1);

  if (!row) return c.json({ error: 'Not found' }, 404);

  return c.json(row);
});

// ---------------------------------------------------------------------------
// POST /api/crm-reviews/:id/analyze — re-trigger analysis
// ---------------------------------------------------------------------------

router.post('/:id/analyze', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(schema.crm_submissions)
    .where(
      and(
        eq(schema.crm_submissions.id, id),
        eq(schema.crm_submissions.org_id, auth.orgId),
      ),
    )
    .limit(1);

  if (!existing) return c.json({ error: 'Not found' }, 404);

  const [updated] = await db
    .update(schema.crm_submissions)
    .set({ status: 'analyzing', error: null, updated_at: new Date() })
    .where(eq(schema.crm_submissions.id, id))
    .returning();

  if (process.env.ANTHROPIC_API_KEY) {
    runAnalysis(
      updated.id,
      updated.repo_url,
      updated.app_url,
      updated.description,
      updated.built_for,
    ).catch((err) => console.error('CRM re-analysis failed', updated.id, err));
  }

  return c.json(updated);
});

export { router as crmReviewRoutes };
