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
