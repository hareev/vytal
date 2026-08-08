import { Hono } from 'hono';
import { ilike, and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function fromSlug(slug: string): string {
  return slug.replace(/-/g, ' ')
}

// ---------------------------------------------------------------------------
// GET /customers/search?q=<query>
// Groups contacts by company name and returns account summaries
// ---------------------------------------------------------------------------
router.get('/search', async (c) => {
  const auth = c.get('auth')
  const q = c.req.query('q')?.trim() ?? ''

  if (!q) return c.json([])

  const contacts = await db
    .select({
      company: schema.contacts.company,
      status: schema.contacts.status,
    })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.org_id, auth.orgId),
        ilike(schema.contacts.company, `%${q}%`),
      ),
    )

  const companyMap = new Map<string, { statuses: string[] }>()
  for (const row of contacts) {
    const co = row.company?.trim()
    if (!co) continue
    const existing = companyMap.get(co) ?? { statuses: [] }
    existing.statuses.push(row.status)
    companyMap.set(co, existing)
  }

  const statusPriority: Record<string, number> = { customer: 4, prospect: 3, lead: 2, churned: 1 }

  const results = await Promise.all(
    [...companyMap.entries()].map(async ([companyName, { statuses }]) => {
      const dealRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.deals)
        .innerJoin(schema.contacts, eq(schema.deals.contact_id, schema.contacts.id))
        .where(
          and(
            eq(schema.contacts.org_id, auth.orgId),
            ilike(schema.contacts.company, companyName),
          ),
        )

      const openValueRows = await db
        .select({ total: sql<number>`coalesce(sum(${schema.deals.value}), 0)::int` })
        .from(schema.deals)
        .innerJoin(schema.contacts, eq(schema.deals.contact_id, schema.contacts.id))
        .where(
          and(
            eq(schema.contacts.org_id, auth.orgId),
            ilike(schema.contacts.company, companyName),
            eq(schema.deals.status, 'open'),
          ),
        )

      const primaryStatus = statuses.reduce(
        (best, s) => ((statusPriority[s] ?? 0) > (statusPriority[best] ?? 0) ? s : best),
        'lead',
      )

      return {
        companySlug: toSlug(companyName),
        companyName,
        contactCount: statuses.length,
        dealCount: Number(dealRows[0]?.count ?? 0),
        openDealValue: Number(openValueRows[0]?.total ?? 0),
        primaryStatus,
      }
    }),
  )

  return c.json(results.sort((a, b) => b.contactCount - a.contactCount))
})

// ---------------------------------------------------------------------------
// GET /customers/:slug
// Assembles full account profile for a company
// ---------------------------------------------------------------------------
router.get('/:slug', async (c) => {
  const auth = c.get('auth')
  const slug = c.req.param('slug')
  const approxName = fromSlug(slug)

  const contacts = await db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.org_id, auth.orgId),
        ilike(schema.contacts.company, approxName),
      ),
    )

  if (contacts.length === 0) {
    return c.json({ error: 'Company not found' }, 404)
  }

  const companyName = contacts[0].company ?? approxName
  const contactIds = contacts.map((ct) => ct.id)

  const deals = contactIds.length
    ? await db
        .select({
          id: schema.deals.id,
          title: schema.deals.title,
          value: schema.deals.value,
          currency: schema.deals.currency,
          stage_id: schema.deals.stage_id,
          status: schema.deals.status,
          close_date: schema.deals.close_date,
          contact_id: schema.deals.contact_id,
        })
        .from(schema.deals)
        .where(eq(schema.deals.org_id, auth.orgId))
        .then((rows) => rows.filter((d) => d.contact_id != null && contactIds.includes(d.contact_id)))
    : []

  const accountContacts = contacts.map((ct) => ({
    id: ct.id,
    name: `${ct.first_name} ${ct.last_name}`,
    email: ct.email ?? '',
    phone: ct.phone ?? undefined,
    status: ct.status,
    tags: ct.tags ?? [],
  }))

  const accountDeals = deals.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    currency: d.currency,
    stage: d.stage_id,
    status: d.status,
    closeDate: d.close_date ?? undefined,
  }))

  return c.json({
    companySlug: toSlug(companyName),
    companyName,
    contacts: accountContacts,
    deals: accountDeals,
    signals: [],
  })
})

export { router as customerRoutes }
