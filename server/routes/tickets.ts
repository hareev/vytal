import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computeSla(priority: string): Date {
  const now = new Date();
  const hoursMap: Record<string, number> = {
    urgent: 8,
    high: 24,
    medium: 72,
    low: 72,
  };
  const hours = hoursMap[priority] ?? 72;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  contact_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

const updateTicketSchema = createTicketSchema.partial().extend({
  resolved_at: z.string().datetime().optional(),
});

const createMessageSchema = z.object({
  body: z.string().min(1),
  is_internal: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /tickets
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');
  const { status, priority, assignee_id } = c.req.query();

  const conditions = [eq(schema.tickets.org_id, auth.orgId)];

  if (status) {
    conditions.push(
      eq(schema.tickets.status, status as 'open' | 'pending' | 'resolved' | 'closed'),
    );
  }

  if (priority) {
    conditions.push(
      eq(schema.tickets.priority, priority as 'low' | 'medium' | 'high' | 'urgent'),
    );
  }

  if (assignee_id) {
    conditions.push(eq(schema.tickets.assignee_id, assignee_id));
  }

  const rows = await db
    .select()
    .from(schema.tickets)
    .where(and(...conditions))
    .orderBy(desc(schema.tickets.created_at));

  return c.json({ data: rows });
});

// ---------------------------------------------------------------------------
// POST /tickets
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createTicketSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const priority = body.priority ?? 'medium';
  const sla_due_at = computeSla(priority);

  const [ticket] = await db
    .insert(schema.tickets)
    .values({ ...body, priority, org_id: auth.orgId, sla_due_at })
    .returning();

  return c.json(ticket, 201);
});

// ---------------------------------------------------------------------------
// GET /tickets/:id — ticket + messages
// ---------------------------------------------------------------------------
router.get('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [ticket] = await db
    .select()
    .from(schema.tickets)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)))
    .limit(1);

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const messages = await db
    .select()
    .from(schema.ticket_messages)
    .where(eq(schema.ticket_messages.ticket_id, id))
    .orderBy(desc(schema.ticket_messages.created_at));

  return c.json({ ...ticket, messages });
});

// ---------------------------------------------------------------------------
// PATCH /tickets/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateTicketSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.tickets)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const updateData: Record<string, unknown> = { ...body, updated_at: new Date() };

  // Auto-set resolved_at when transitioning to resolved
  if (body.status === 'resolved' && !existing.resolved_at && !body.resolved_at) {
    updateData.resolved_at = new Date();
  }

  const [ticket] = await db
    .update(schema.tickets)
    .set(updateData)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)))
    .returning();

  return c.json(ticket);
});

// ---------------------------------------------------------------------------
// POST /tickets/:id/messages
// ---------------------------------------------------------------------------
router.post('/:id/messages', zValidator('json', createMessageSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [ticket] = await db
    .select()
    .from(schema.tickets)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)))
    .limit(1);

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const [message] = await db
    .insert(schema.ticket_messages)
    .values({ ...body, ticket_id: id, author_id: auth.userId })
    .returning();

  return c.json(message, 201);
});

// ---------------------------------------------------------------------------
// DELETE /tickets/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.tickets)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  await db
    .delete(schema.tickets)
    .where(and(eq(schema.tickets.id, id), eq(schema.tickets.org_id, auth.orgId)));

  return c.json({ success: true });
});

export default router;
