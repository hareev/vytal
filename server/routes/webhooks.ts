import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { WebhookEventName } from '../lib/webhookDispatcher.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Allowed event names
// ---------------------------------------------------------------------------
const ALLOWED_EVENTS = [
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'deal.created',
  'deal.updated',
  'deal.won',
  'deal.lost',
  'ticket.created',
  'ticket.updated',
  'ticket.resolved',
  'campaign.sent',
  'sequence.enrolled',
  'sequence.completed',
] as const satisfies readonly WebhookEventName[];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createWebhookSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS',
  }),
  events: z
    .array(z.enum(ALLOWED_EVENTS))
    .min(1, 'At least one event is required'),
  description: z.string().optional(),
});

const updateWebhookSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS',
    })
    .optional(),
  events: z.array(z.enum(ALLOWED_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helper: mask secret
// ---------------------------------------------------------------------------
function maskSecret(secret: string): string {
  return `${secret.slice(0, 8)}...`;
}

// ---------------------------------------------------------------------------
// GET /webhooks
// ---------------------------------------------------------------------------
router.get('/', async (c) => {
  const auth = c.get('auth');

  const rows = await db
    .select()
    .from(schema.webhooks)
    .where(eq(schema.webhooks.org_id, auth.orgId));

  const masked = rows.map((wh) => ({ ...wh, secret: maskSecret(wh.secret) }));

  return c.json({ data: masked });
});

// ---------------------------------------------------------------------------
// POST /webhooks
// ---------------------------------------------------------------------------
router.post('/', zValidator('json', createWebhookSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const secret = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(schema.webhooks)
    .values({
      org_id: auth.orgId,
      url: body.url,
      events: body.events,
      secret,
      description: body.description,
    })
    .returning();

  return c.json({ data: webhook }, 201);
});

// ---------------------------------------------------------------------------
// PATCH /webhooks/:id
// ---------------------------------------------------------------------------
router.patch('/:id', zValidator('json', updateWebhookSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const [updated] = await db
    .update(schema.webhooks)
    .set(body)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.org_id, auth.orgId)))
    .returning();

  return c.json({ data: { ...updated, secret: maskSecret(updated.secret) } });
});

// ---------------------------------------------------------------------------
// DELETE /webhooks/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  await db
    .delete(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.org_id, auth.orgId)));

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /webhooks/:id/test
// ---------------------------------------------------------------------------
router.post('/:id/test', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [webhook] = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.org_id, auth.orgId)))
    .limit(1);

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const pingPayload = {
    event: 'ping',
    orgId: auth.orgId,
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test ping from Vytal.' },
  };

  const body = JSON.stringify(pingPayload);

  const hmac = crypto.createHmac('sha256', webhook.secret);
  hmac.update(body);
  const signature = `sha256=${hmac.digest('hex')}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vytal-Signature': signature,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return c.json({ success: true, status: res.status });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: message }, 502);
  }
});

export { router as webhookRoutes };
