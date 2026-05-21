import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// organizations
// ---------------------------------------------------------------------------
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan', { enum: ['free', 'starter', 'pro'] }).notNull().default('free'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  status: text('status', {
    enum: ['lead', 'prospect', 'customer', 'churned'],
  })
    .notNull()
    .default('lead'),
  tags: text('tags').array(),
  notes: text('notes'),
  owner_id: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// pipelines
// ---------------------------------------------------------------------------
export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  is_default: boolean('is_default').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// pipeline_stages
// ---------------------------------------------------------------------------
export const pipeline_stages = pgTable('pipeline_stages', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  pipeline_id: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  probability: integer('probability').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// deals
// ---------------------------------------------------------------------------
export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  value: numeric('value').notNull().default('0'),
  currency: text('currency').notNull().default('USD'),
  stage_id: uuid('stage_id')
    .notNull()
    .references(() => pipeline_stages.id),
  pipeline_id: uuid('pipeline_id')
    .notNull()
    .references(() => pipelines.id),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  owner_id: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  close_date: date('close_date'),
  status: text('status', { enum: ['open', 'won', 'lost'] }).notNull().default('open'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// activities
// ---------------------------------------------------------------------------
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['call', 'email', 'meeting', 'task', 'note'],
  }).notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  deal_id: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  due_at: timestamp('due_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// segments
// ---------------------------------------------------------------------------
export const segments = pgTable('segments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(),
  contact_count: integer('contact_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// campaigns
// ---------------------------------------------------------------------------
export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['email', 'sms', 'push'] }).notNull(),
  status: text('status', {
    enum: ['draft', 'scheduled', 'sending', 'sent', 'paused'],
  })
    .notNull()
    .default('draft'),
  segment_id: uuid('segment_id').references(() => segments.id, { onDelete: 'set null' }),
  subject: text('subject'),
  body: text('body'),
  scheduled_at: timestamp('scheduled_at'),
  sent_at: timestamp('sent_at'),
  stats: jsonb('stats'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// sequences
// ---------------------------------------------------------------------------
export const sequences = pgTable('sequences', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'paused'] }).notNull().default('paused'),
  trigger_event: text('trigger_event').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// sequence_steps
// ---------------------------------------------------------------------------
export const sequence_steps = pgTable('sequence_steps', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  sequence_id: uuid('sequence_id')
    .notNull()
    .references(() => sequences.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  type: text('type', { enum: ['email', 'wait', 'condition'] }).notNull(),
  delay_hours: integer('delay_hours'),
  subject: text('subject'),
  body: text('body'),
});

// ---------------------------------------------------------------------------
// tickets
// ---------------------------------------------------------------------------
export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['open', 'pending', 'resolved', 'closed'],
  })
    .notNull()
    .default('open'),
  priority: text('priority', {
    enum: ['low', 'medium', 'high', 'urgent'],
  })
    .notNull()
    .default('medium'),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  assignee_id: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  tags: text('tags').array(),
  sla_due_at: timestamp('sla_due_at'),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// ticket_messages
// ---------------------------------------------------------------------------
export const ticket_messages = pgTable('ticket_messages', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  ticket_id: uuid('ticket_id')
    .notNull()
    .references(() => tickets.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  author_id: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  is_internal: boolean('is_internal').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// scan_history — stores each health scan result for trend tracking
// ---------------------------------------------------------------------------
export const scan_history = pgTable('scan_history', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  org_name: text('org_name').notNull(),
  overall_score: integer('overall_score').notNull(),
  dimension_scores: jsonb('dimension_scores').notNull(),
  issue_count: integer('issue_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// webhooks — outbound event subscriptions per org
// ---------------------------------------------------------------------------
export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: text('events').array().notNull(),
  secret: text('secret').notNull(),
  active: boolean('active').notNull().default(true),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// kb_categories — knowledge base categories
// ---------------------------------------------------------------------------
export const kb_categories = pgTable('kb_categories', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// kb_articles — knowledge base articles
// ---------------------------------------------------------------------------
export const kb_articles = pgTable('kb_articles', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  category_id: uuid('category_id').references(() => kb_categories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  author_id: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  view_count: integer('view_count').notNull().default(0),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// sequence_enrollments — contacts enrolled in drip sequences
// ---------------------------------------------------------------------------
export const sequence_enrollments = pgTable('sequence_enrollments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sequence_id: uuid('sequence_id')
    .notNull()
    .references(() => sequences.id, { onDelete: 'cascade' }),
  contact_id: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  current_step: integer('current_step').notNull().default(0),
  status: text('status', { enum: ['active', 'completed', 'unenrolled'] }).notNull().default('active'),
  next_send_at: timestamp('next_send_at'),
  enrolled_at: timestamp('enrolled_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

// ---------------------------------------------------------------------------
// channel_captures — universal conversation capture (email/chat/call/doc)
// ---------------------------------------------------------------------------
export const channel_captures = pgTable('channel_captures', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  org_id: uuid('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  channel_type: text('channel_type', {
    enum: ['email', 'chat', 'call_transcript', 'document', 'sms', 'manual'],
  }).notNull(),
  status: text('status', {
    enum: ['raw', 'processing', 'ready', 'accepted', 'dismissed'],
  }).notNull().default('raw'),
  raw_content: text('raw_content').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  extraction: jsonb('extraction'),
  linked_contact_ids: text('linked_contact_ids').array().notNull().default([]),
  linked_deal_ids: text('linked_deal_ids').array().notNull().default([]),
  linked_activity_id: uuid('linked_activity_id').references(() => activities.id, { onDelete: 'set null' }),
  accepted_at: timestamp('accepted_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
