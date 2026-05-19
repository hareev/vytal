import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { dispatchWebhook } from '../lib/webhookDispatcher.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createSequenceSchema = z.object({
  name: z.string().min(1),
  status: z.enum(['active', 'paused']).optional(),
  trigger_event: z.string().min(1),
});

const updateSequenceSchema = createSequenceSchema.partial();

const enrollContactSchema = z.object({
  contactId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /sequences
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const rows = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.org_id, auth.orgId))
    .orderBy(desc(schema.sequences.created_at));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /sequences
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createSequenceSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [sequence] = await db
    .insert(schema.sequences)
    .values({ ...body, org_id: auth.orgId })
    .returning();

  return c.json({ data: sequence }, 201);
});

// ---------------------------------------------------------------------------
// PATCH /sequences/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateSequenceSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Sequence not found' }, 404);
  }

  const [updated] = await db
    .update(schema.sequences)
    .set(body)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .returning();

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /sequences/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Sequence not found' }, 404);
  }

  await db
    .delete(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)));

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /sequences/:id/enrollments
// ---------------------------------------------------------------------------
router.get('/:id/enrollments', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  // Verify the sequence belongs to the org
  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .limit(1);

  if (!sequence) {
    return c.json({ error: 'Sequence not found' }, 404);
  }

  const enrollments = await db
    .select()
    .from(schema.sequence_enrollments)
    .where(
      and(
        eq(schema.sequence_enrollments.sequence_id, id),
        eq(schema.sequence_enrollments.org_id, auth.orgId),
      ),
    )
    .orderBy(desc(schema.sequence_enrollments.enrolled_at));

  return c.json({ data: enrollments });
});

// ---------------------------------------------------------------------------
// POST /sequences/:id/enroll
// ---------------------------------------------------------------------------
router.post('/:id/enroll', zValidator('json', enrollContactSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const { contactId } = c.req.valid('json');

  // Verify the sequence belongs to the org
  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .limit(1);

  if (!sequence) {
    return c.json({ error: 'Sequence not found' }, 404);
  }

  // Verify the contact belongs to the org
  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.org_id, auth.orgId)))
    .limit(1);

  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404);
  }

  // Get first step to determine initial next_send_at
  const [firstStep] = await db
    .select()
    .from(schema.sequence_steps)
    .where(eq(schema.sequence_steps.sequence_id, id))
    .orderBy(schema.sequence_steps.position)
    .limit(1);

  const nextSendAt = firstStep
    ? new Date(Date.now() + (firstStep.delay_hours ?? 0) * 60 * 60 * 1000)
    : new Date();

  const [enrollment] = await db
    .insert(schema.sequence_enrollments)
    .values({
      org_id: auth.orgId,
      sequence_id: id,
      contact_id: contactId,
      current_step: 0,
      status: 'active',
      next_send_at: nextSendAt,
    })
    .returning();

  // Fire webhook
  await dispatchWebhook(auth.orgId, 'sequence.enrolled', {
    sequenceId: id,
    contactId,
    enrollmentId: enrollment.id,
  });

  return c.json({ data: enrollment }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /sequences/:id/enrollments/:enrollmentId
// ---------------------------------------------------------------------------
router.delete('/:id/enrollments/:enrollmentId', async (c) => {
  const auth = c.get('auth');
  const { id, enrollmentId } = c.req.param();

  // Verify the sequence belongs to the org
  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.org_id, auth.orgId)))
    .limit(1);

  if (!sequence) {
    return c.json({ error: 'Sequence not found' }, 404);
  }

  const [existing] = await db
    .select()
    .from(schema.sequence_enrollments)
    .where(
      and(
        eq(schema.sequence_enrollments.id, enrollmentId),
        eq(schema.sequence_enrollments.sequence_id, id),
        eq(schema.sequence_enrollments.org_id, auth.orgId),
      ),
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Enrollment not found' }, 404);
  }

  await db
    .update(schema.sequence_enrollments)
    .set({ status: 'unenrolled' })
    .where(
      and(
        eq(schema.sequence_enrollments.id, enrollmentId),
        eq(schema.sequence_enrollments.org_id, auth.orgId),
      ),
    );

  return c.json({ success: true });
});

export { router as sequenceRoutes };
