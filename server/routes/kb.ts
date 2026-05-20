import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, ilike, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  position: z.number().int().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const createArticleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

const updateArticleSchema = createArticleSchema.partial();

// ---------------------------------------------------------------------------
// GET /kb/categories
// ---------------------------------------------------------------------------
router.get('/categories', async (c) => {
  const auth = c.get('auth');

  const categories = await db
    .select()
    .from(schema.kb_categories)
    .where(eq(schema.kb_categories.org_id, auth.orgId))
    .orderBy(schema.kb_categories.position, schema.kb_categories.created_at);

  // Attach article counts
  const counts = await db
    .select({
      category_id: schema.kb_articles.category_id,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(schema.kb_articles)
    .where(eq(schema.kb_articles.org_id, auth.orgId))
    .groupBy(schema.kb_articles.category_id);

  const countMap = new Map(counts.map((r) => [r.category_id, r.count]));

  const result = categories.map((cat) => ({
    ...cat,
    articleCount: countMap.get(cat.id) ?? 0,
  }));

  return c.json(result);
});

// ---------------------------------------------------------------------------
// POST /kb/categories
// ---------------------------------------------------------------------------
router.post('/categories', zValidator('json', createCategorySchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [category] = await db
    .insert(schema.kb_categories)
    .values({
      org_id: auth.orgId,
      name: body.name,
      slug: slugify(body.name),
      description: body.description,
      position: body.position ?? 0,
    })
    .returning();

  return c.json({ data: category }, 201);
});

// ---------------------------------------------------------------------------
// PATCH /kb/categories/:id
// ---------------------------------------------------------------------------
router.patch('/categories/:id', zValidator('json', updateCategorySchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.kb_categories)
    .where(and(eq(schema.kb_categories.id, id), eq(schema.kb_categories.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  const updateData: Record<string, unknown> = { ...body };
  if (body.name) {
    updateData.slug = slugify(body.name);
  }

  const [updated] = await db
    .update(schema.kb_categories)
    .set(updateData)
    .where(and(eq(schema.kb_categories.id, id), eq(schema.kb_categories.org_id, auth.orgId)))
    .returning();

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /kb/categories/:id
// ---------------------------------------------------------------------------
router.delete('/categories/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.kb_categories)
    .where(and(eq(schema.kb_categories.id, id), eq(schema.kb_categories.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Category not found' }, 404);
  }

  // Prevent deletion if there are published articles
  const [publishedCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(schema.kb_articles)
    .where(
      and(
        eq(schema.kb_articles.category_id, id),
        eq(schema.kb_articles.status, 'published'),
      ),
    );

  if ((publishedCount?.count ?? 0) > 0) {
    return c.json({ error: 'Cannot delete category with published articles' }, 409);
  }

  await db
    .delete(schema.kb_categories)
    .where(and(eq(schema.kb_categories.id, id), eq(schema.kb_categories.org_id, auth.orgId)));

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /kb/articles
// ---------------------------------------------------------------------------
router.get('/articles', async (c) => {
  const auth = c.get('auth');
  const { status, category_id, search } = c.req.query();

  const conditions = [eq(schema.kb_articles.org_id, auth.orgId)];

  if (status === 'draft' || status === 'published') {
    conditions.push(eq(schema.kb_articles.status, status));
  }

  if (category_id) {
    conditions.push(eq(schema.kb_articles.category_id, category_id));
  }

  if (search) {
    conditions.push(
      ilike(schema.kb_articles.title, `%${search}%`),
    );
  }

  const articles = await db
    .select()
    .from(schema.kb_articles)
    .where(and(...conditions))
    .orderBy(desc(schema.kb_articles.updated_at));

  return c.json(articles);
});

// ---------------------------------------------------------------------------
// POST /kb/articles
// ---------------------------------------------------------------------------
router.post('/articles', zValidator('json', createArticleSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');

  const [article] = await db
    .insert(schema.kb_articles)
    .values({
      org_id: auth.orgId,
      title: body.title,
      slug: slugify(body.title),
      body: body.body,
      category_id: body.categoryId,
      status: body.status ?? 'draft',
      author_id: auth.userId,
    })
    .returning();

  return c.json({ data: article }, 201);
});

// ---------------------------------------------------------------------------
// GET /kb/articles/:id
// ---------------------------------------------------------------------------
router.get('/articles/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [article] = await db
    .select()
    .from(schema.kb_articles)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .limit(1);

  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  // Increment view count
  await db
    .update(schema.kb_articles)
    .set({ view_count: article.view_count + 1 })
    .where(eq(schema.kb_articles.id, id));

  return c.json({ data: { ...article, view_count: article.view_count + 1 } });
});

// ---------------------------------------------------------------------------
// PATCH /kb/articles/:id
// ---------------------------------------------------------------------------
router.patch('/articles/:id', zValidator('json', updateArticleSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(schema.kb_articles)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }

  const updateData: Record<string, unknown> = {
    ...body,
    category_id: body.categoryId,
    updated_at: new Date(),
  };
  delete updateData['categoryId'];

  if (body.title) {
    updateData.slug = slugify(body.title);
  }

  const [updated] = await db
    .update(schema.kb_articles)
    .set(updateData)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .returning();

  return c.json({ data: updated });
});

// ---------------------------------------------------------------------------
// DELETE /kb/articles/:id
// ---------------------------------------------------------------------------
router.delete('/articles/:id', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.kb_articles)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }

  await db
    .delete(schema.kb_articles)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)));

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /kb/articles/:id/publish
// ---------------------------------------------------------------------------
router.post('/articles/:id/publish', async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.param();

  const [existing] = await db
    .select()
    .from(schema.kb_articles)
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Article not found' }, 404);
  }

  const [updated] = await db
    .update(schema.kb_articles)
    .set({ status: 'published', updated_at: new Date() })
    .where(and(eq(schema.kb_articles.id, id), eq(schema.kb_articles.org_id, auth.orgId)))
    .returning();

  return c.json({ data: updated });
});

export default router;
