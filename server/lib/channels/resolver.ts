import { eq, and, or, sql } from 'drizzle-orm'
import { db, schema } from '../../db/index.js'
import type { CapturedEvent } from './base.js'

export interface ResolveResult {
  contactId: string
  status: 'resolved' | 'duplicate'
}

export async function resolveEvent(
  eventId: string,
  event: CapturedEvent,
  orgId: string,
): Promise<ResolveResult> {
  const { email, phone, name, metadata } = event.contact

  // ── 1. Dedup: find existing contact by email or phone ─────────────────────
  const dedupConditions = []
  if (email) dedupConditions.push(eq(schema.contacts.email, email))
  if (phone) dedupConditions.push(eq(schema.contacts.phone, phone))

  let existingContactId: string | undefined

  if (dedupConditions.length > 0) {
    const [existing] = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(and(eq(schema.contacts.org_id, orgId), or(...dedupConditions)))
      .limit(1)

    existingContactId = existing?.id
  }

  let contactId: string
  let status: ResolveResult['status']

  if (existingContactId) {
    // ── 2a. Duplicate — contact already exists ─────────────────────────────
    contactId = existingContactId
    status = 'duplicate'

    await db
      .update(schema.channel_events)
      .set({ status: 'duplicate', resolved_contact_id: contactId, processed_at: new Date() })
      .where(eq(schema.channel_events.id, eventId))
  } else {
    // ── 2b. New contact — insert ───────────────────────────────────────────
    const firstName = (metadata?.firstName as string | undefined)
      ?? (name ? name.trim().split(/\s+/)[0] : 'Unknown')
    const lastName = (metadata?.lastName as string | undefined)
      ?? (name && name.trim().split(/\s+/).length > 1
        ? name.trim().split(/\s+/).slice(1).join(' ')
        : undefined)

    const [newContact] = await db
      .insert(schema.contacts)
      .values({
        org_id: orgId,
        first_name: firstName,
        last_name: lastName ?? '',
        email: email ?? undefined,
        phone: phone ?? undefined,
        status: 'lead',
        source: event.source,
      })
      .returning({ id: schema.contacts.id })

    contactId = newContact.id
    status = 'resolved'

    await db
      .update(schema.channel_events)
      .set({ status: 'resolved', resolved_contact_id: contactId, processed_at: new Date() })
      .where(eq(schema.channel_events.id, eventId))
  }

  // ── 3. Create activity record ──────────────────────────────────────────────
  const activityDesc = [
    `Source: ${event.source}`,
    event.intent ? `Intent: ${event.intent}` : null,
    metadata?.message ? `Message: ${metadata.message}` : null,
  ].filter(Boolean).join(' · ')

  // Find any user in the org to assign the activity (owner or first user)
  const [orgUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.org_id, orgId))
    .limit(1)

  if (orgUser) {
    await db.insert(schema.activities).values({
      org_id: orgId,
      type: 'note',
      subject: `Channel capture via ${event.source}`,
      description: activityDesc,
      contact_id: contactId,
      user_id: orgUser.id,
    })
  }

  return { contactId, status }
}

// Silence unused import warning — sql is imported for potential future use in
// complex dedup queries (e.g. case-insensitive email matching via sql``)
void sql
