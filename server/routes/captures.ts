import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { processCapture } from '../lib/captureProcessor.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createCaptureSchema = z.object({
  channelType: z.enum(['email', 'chat', 'call_transcript', 'document', 'sms', 'manual']),
  rawContent: z.string().min(10),
  metadata: z
    .object({
      from: z.string().optional(),
      to: z.array(z.string()).optional(),
      cc: z.array(z.string()).optional(),
      subject: z.string().optional(),
      duration: z.number().optional(),
      participants: z.array(z.string()).optional(),
      fileName: z.string().optional(),
      source: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Helper — map intent to activity type
// ---------------------------------------------------------------------------
function intentToActivityType(
  intent: string,
  channelType: string,
): 'call' | 'email' | 'meeting' | 'task' | 'note' {
  if (channelType === 'call_transcript') return 'call';
  if (channelType === 'email') return 'email';
  if (intent === 'sales' || intent === 'general') return 'email';
  return 'note';
}

// ---------------------------------------------------------------------------
// Helper — run AI processing and update capture in DB
// ---------------------------------------------------------------------------
async function runProcessing(
  captureId: string,
  rawContent: string,
  channelType: string,
  metadata: Record<string, unknown>,
  orgId: string,
): Promise<void> {
  // Fetch contacts for this org
  const rawContacts = await db
    .select({
      id: schema.contacts.id,
      firstName: schema.contacts.first_name,
      lastName: schema.contacts.last_name,
      email: schema.contacts.email,
      company: schema.contacts.company,
    })
    .from(schema.contacts)
    .where(eq(schema.contacts.org_id, orgId));

  const orgContacts = rawContacts.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email ?? undefined,
    company: c.company ?? undefined,
  }));

  // Fetch open deals for this org
  const orgDeals = await db
    .select({
      id: schema.deals.id,
      title: schema.deals.title,
      value: schema.deals.value,
    })
    .from(schema.deals)
    .where(and(eq(schema.deals.org_id, orgId), eq(schema.deals.status, 'open')));

  const extraction = await processCapture(
    rawContent,
    channelType,
    metadata as Parameters<typeof processCapture>[2],
    orgContacts,
    orgDeals,
  );

  // Gather matched contact IDs
  const linkedContactIds = extraction.contacts
    .filter((c) => c.existingContactId != null)
    .map((c) => c.existingContactId as string);

  await db
    .update(schema.channel_captures)
    .set({
      status: 'ready',
      extraction: extraction as unknown as Record<string, unknown>,
      linked_contact_ids: linkedContactIds,
      updated_at: new Date(),
    })
    .where(
      and(eq(schema.channel_captures.id, captureId), eq(schema.channel_captures.org_id, orgId)),
    );
}

// ---------------------------------------------------------------------------
// GET /captures
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');
  const { status, channel_type, page, limit } = c.req.query();

  const pageNum = Math.max(1, parseInt(page ?? '1', 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10)));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(schema.channel_captures.org_id, auth.orgId)];

  if (status) {
    conditions.push(
      eq(
        schema.channel_captures.status,
        status as 'raw' | 'processing' | 'ready' | 'accepted' | 'dismissed',
      ),
    );
  }

  if (channel_type) {
    conditions.push(
      eq(
        schema.channel_captures.channel_type,
        channel_type as 'email' | 'chat' | 'call_transcript' | 'document' | 'sms' | 'manual',
      ),
    );
  }

  const rows = await db
    .select()
    .from(schema.channel_captures)
    .where(and(...conditions))
    .orderBy(desc(schema.channel_captures.created_at))
    .limit(limitNum)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.channel_captures)
    .where(and(...conditions));

  return c.json({ data: rows, meta: { page: pageNum, limit: limitNum, total: count } });
});

// ---------------------------------------------------------------------------
// POST /captures — create + auto-process
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createCaptureSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const metadata = body.metadata ?? {};

  // Insert with status='raw'
  const [capture] = await db
    .insert(schema.channel_captures)
    .values({
      org_id: auth.orgId,
      channel_type: body.channelType,
      status: 'raw',
      raw_content: body.rawContent,
      metadata: metadata as Record<string, unknown>,
    })
    .returning();

  // Auto-process if API key is configured
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      await runProcessing(
        capture.id,
        body.rawContent,
        body.channelType,
        metadata as Record<string, unknown>,
        auth.orgId,
      );
      // Return the updated capture
      const [updated] = await db
        .select()
        .from(schema.channel_captures)
        .where(eq(schema.channel_captures.id, capture.id))
        .limit(1);
      return c.json(updated, 201);
    } catch (err) {
      console.error('Channel Capture AI processing failed:', err);
      // Fall through — return raw capture
    }
  }

  return c.json(capture, 201);
});

// ---------------------------------------------------------------------------
// GET /captures/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [capture] = await db
    .select()
    .from(schema.channel_captures)
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .limit(1);

  if (!capture) {
    return c.json({ error: 'Capture not found' }, 404);
  }

  return c.json(capture);
});

// ---------------------------------------------------------------------------
// POST /captures/:id/process — re-run AI processing
// ---------------------------------------------------------------------------
router.post('/:id/process', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [capture] = await db
    .select()
    .from(schema.channel_captures)
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .limit(1);

  if (!capture) {
    return c.json({ error: 'Capture not found' }, 404);
  }

  try {
    await runProcessing(
      capture.id,
      capture.raw_content,
      capture.channel_type,
      capture.metadata as Record<string, unknown>,
      auth.orgId,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI processing failed';
    return c.json({ error: message }, 500);
  }

  const [updated] = await db
    .select()
    .from(schema.channel_captures)
    .where(eq(schema.channel_captures.id, id))
    .limit(1);

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// POST /captures/:id/accept — create Activity + link everything
// ---------------------------------------------------------------------------
router.post('/:id/accept', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [capture] = await db
    .select()
    .from(schema.channel_captures)
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .limit(1);

  if (!capture) {
    return c.json({ error: 'Capture not found' }, 404);
  }

  if (capture.status !== 'ready') {
    return c.json({ error: 'Capture must be in ready status to accept' }, 400);
  }

  const extraction = capture.extraction as {
    summary?: string;
    intent?: string;
    keyPoints?: string[];
  } | null;

  const summary = extraction?.summary ?? '';
  const intent = extraction?.intent ?? 'general';
  const keyPoints: string[] = extraction?.keyPoints ?? [];

  const activityType = intentToActivityType(intent, capture.channel_type);
  const subject = summary.slice(0, 100);
  const description =
    summary + (keyPoints.length > 0 ? '\n\nKey Points:\n' + keyPoints.join('\n') : '');

  // First linked contact (if any)
  const firstContactId =
    capture.linked_contact_ids && capture.linked_contact_ids.length > 0
      ? capture.linked_contact_ids[0]
      : undefined;

  const [activity] = await db
    .insert(schema.activities)
    .values({
      org_id: auth.orgId,
      type: activityType,
      subject,
      description,
      contact_id: firstContactId ?? null,
      user_id: auth.userId,
    })
    .returning();

  const [updated] = await db
    .update(schema.channel_captures)
    .set({
      status: 'accepted',
      linked_activity_id: activity.id,
      accepted_at: new Date(),
      updated_at: new Date(),
    })
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .returning();

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// POST /captures/:id/dismiss
// ---------------------------------------------------------------------------
router.post('/:id/dismiss', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.channel_captures)
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Capture not found' }, 404);
  }

  const [updated] = await db
    .update(schema.channel_captures)
    .set({ status: 'dismissed', updated_at: new Date() })
    .where(and(eq(schema.channel_captures.id, id), eq(schema.channel_captures.org_id, auth.orgId)))
    .returning();

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// POST /captures/ingest — webhook endpoint for external tools (e.g. Zapier)
// ---------------------------------------------------------------------------
router.post('/ingest', zValidator('json', createCaptureSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const metadata = body.metadata ?? {};

  const [capture] = await db
    .insert(schema.channel_captures)
    .values({
      org_id: auth.orgId,
      channel_type: body.channelType,
      status: 'raw',
      raw_content: body.rawContent,
      metadata: metadata as Record<string, unknown>,
    })
    .returning();

  if (process.env.ANTHROPIC_API_KEY) {
    // Fire-and-forget — don't block the webhook response
    runProcessing(
      capture.id,
      body.rawContent,
      body.channelType,
      metadata as Record<string, unknown>,
      auth.orgId,
    ).catch((err: unknown) => {
      console.error('Ingest AI processing failed for capture', capture.id, err);
    });
  }

  return c.json({ captureId: capture.id, status: capture.status }, 202);
});

export { router as captureRoutes };
