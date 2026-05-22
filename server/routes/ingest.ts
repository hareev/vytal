import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { getAdapter, listSources } from '../lib/channels/index.js'
import { resolveEvent } from '../lib/channels/resolver.js'

export const ingestRoutes = new Hono()

const orgIdSchema = z.object({
  org_id: z.string().uuid({ message: 'org_id query param must be a valid UUID' }),
})

// ---------------------------------------------------------------------------
// POST /ingest/:source
// Public endpoint — receives webhooks and embedded form submissions.
// org_id is passed as a query param (?org_id=<uuid>).
// ---------------------------------------------------------------------------
ingestRoutes.post('/:source', zValidator('query', orgIdSchema), async (c) => {
  const { source } = c.req.param()
  const { org_id: orgId } = c.req.valid('query')

  // ── 1. Look up adapter ────────────────────────────────────────────────────
  const adapter = getAdapter(source)
  if (!adapter) {
    return c.json(
      { error: `Unknown source '${source}'. Supported sources: ${listSources().join(', ')}` },
      404,
    )
  }

  // ── 2. Verify signature / token ───────────────────────────────────────────
  const verified = await adapter.verify(c.req.raw)
  if (!verified) {
    return c.json({ error: 'Webhook verification failed' }, 401)
  }

  // ── 3. Parse the body ─────────────────────────────────────────────────────
  let body: unknown
  try {
    const contentType = c.req.header('content-type') ?? ''
    if (contentType.includes('application/json')) {
      body = await c.req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData()
      const obj: Record<string, string> = {}
      formData.forEach((val, key) => { obj[key] = val.toString() })
      body = obj
    } else {
      body = await c.req.json().catch(() => ({}))
    }
  } catch {
    return c.json({ error: 'Could not parse request body' }, 400)
  }

  let event
  try {
    event = await adapter.parse(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse error'
    return c.json({ error: message }, 400)
  }

  // ── 4. Write raw event to channel_events ──────────────────────────────────
  const [inserted] = await db
    .insert(schema.channel_events)
    .values({
      org_id: orgId,
      source: event.source,
      external_id: event.externalId,
      status: 'pending',
      raw_payload: event.rawPayload as Record<string, unknown>,
    })
    .returning({ id: schema.channel_events.id })

  // ── 5. Resolve synchronously ─────────────────────────────────────────────
  let resolveResult: { contactId: string; status: string }
  try {
    resolveResult = await resolveEvent(inserted.id, event, orgId)
  } catch {
    await db
      .update(schema.channel_events)
      .set({ status: 'failed', processed_at: new Date() })
      .where(eq(schema.channel_events.id, inserted.id))

    return c.json({ error: 'Resolver failed — event stored for retry' }, 500)
  }

  // ── 6. Return result ──────────────────────────────────────────────────────
  return c.json({
    eventId: inserted.id,
    contactId: resolveResult.contactId,
    status: resolveResult.status,
    source,
  }, 200)
})

// ---------------------------------------------------------------------------
// GET /ingest/sources — list available source adapters
// ---------------------------------------------------------------------------
ingestRoutes.get('/sources', (c) => {
  return c.json({ sources: listSources() })
})
