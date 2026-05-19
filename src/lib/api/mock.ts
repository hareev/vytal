import type { Contact, Deal, Pipeline, Stage } from '@/types/crm'
import type { Campaign, Segment, Sequence, SequenceStep } from '@/types/marketing'
import type { Ticket, TicketMessage } from '@/types/service'
import type { User, Org } from '@/types/auth'
import type { KbCategory, KbArticle, ArticleStatus } from '@/types/kb'
import type { ListParams, AuthLoginResponse, AuthRegisterResponse, MeResponse } from './client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000)
}

function resolve<T>(data: T): Promise<T> {
  return Promise.resolve(data)
}

// ─── Seed: Orgs & Users ───────────────────────────────────────────────────────

const DEMO_ORG_ID = 'org-demo'
const DEMO_USER_ID = 'user-demo'

const DEMO_ORG: Org = {
  id: DEMO_ORG_ID,
  name: 'Acme Corp',
  slug: 'acme',
  plan: 'pro',
  modules: { sales: true, marketing: true, service: true, health: true, knowledge: true },
  createdAt: daysAgo(180),
}

const DEMO_USER: User = {
  id: DEMO_USER_ID,
  orgId: DEMO_ORG_ID,
  email: 'demo@vytal.io',
  name: 'Demo User',
  role: 'owner',
  createdAt: daysAgo(180),
}

// ─── Seed: Pipelines ─────────────────────────────────────────────────────────

const PIPELINE_IDS = ['pipe-sales', 'pipe-enterprise', 'pipe-partner']

const STAGES_RAW: Array<{ id: string; pipelineId: string; name: string; position: number; probability: number }> = [
  // Sales pipeline
  { id: 's1', pipelineId: PIPELINE_IDS[0], name: 'Lead',          position: 0, probability: 10 },
  { id: 's2', pipelineId: PIPELINE_IDS[0], name: 'Qualified',      position: 1, probability: 25 },
  { id: 's3', pipelineId: PIPELINE_IDS[0], name: 'Proposal',       position: 2, probability: 50 },
  { id: 's4', pipelineId: PIPELINE_IDS[0], name: 'Negotiation',    position: 3, probability: 75 },
  { id: 's5', pipelineId: PIPELINE_IDS[0], name: 'Won',            position: 4, probability: 100 },
  // Enterprise pipeline
  { id: 'e1', pipelineId: PIPELINE_IDS[1], name: 'Discovery',      position: 0, probability: 10 },
  { id: 'e2', pipelineId: PIPELINE_IDS[1], name: 'Evaluation',     position: 1, probability: 30 },
  { id: 'e3', pipelineId: PIPELINE_IDS[1], name: 'Business Case',  position: 2, probability: 55 },
  { id: 'e4', pipelineId: PIPELINE_IDS[1], name: 'Procurement',    position: 3, probability: 80 },
  { id: 'e5', pipelineId: PIPELINE_IDS[1], name: 'Closed',         position: 4, probability: 100 },
  // Partner pipeline
  { id: 'p1', pipelineId: PIPELINE_IDS[2], name: 'Intro',          position: 0, probability: 15 },
  { id: 'p2', pipelineId: PIPELINE_IDS[2], name: 'Aligned',        position: 1, probability: 40 },
  { id: 'p3', pipelineId: PIPELINE_IDS[2], name: 'Agreement',      position: 2, probability: 70 },
  { id: 'p4', pipelineId: PIPELINE_IDS[2], name: 'Active',         position: 3, probability: 100 },
]

const stageMap = new Map<string, Stage>(
  STAGES_RAW.map((s) => [s.id, { ...s, deals: [] }]),
)

const pipelineMap = new Map<string, Pipeline>([
  [PIPELINE_IDS[0], {
    id: PIPELINE_IDS[0], orgId: DEMO_ORG_ID, name: 'Sales', isDefault: true,
    stages: STAGES_RAW.filter((s) => s.pipelineId === PIPELINE_IDS[0]).map((s) => ({ ...s, deals: [] })),
    createdAt: daysAgo(170),
  }],
  [PIPELINE_IDS[1], {
    id: PIPELINE_IDS[1], orgId: DEMO_ORG_ID, name: 'Enterprise', isDefault: false,
    stages: STAGES_RAW.filter((s) => s.pipelineId === PIPELINE_IDS[1]).map((s) => ({ ...s, deals: [] })),
    createdAt: daysAgo(160),
  }],
  [PIPELINE_IDS[2], {
    id: PIPELINE_IDS[2], orgId: DEMO_ORG_ID, name: 'Partner', isDefault: false,
    stages: STAGES_RAW.filter((s) => s.pipelineId === PIPELINE_IDS[2]).map((s) => ({ ...s, deals: [] })),
    createdAt: daysAgo(150),
  }],
])

// ─── Seed: Contacts ───────────────────────────────────────────────────────────

const CONTACTS_SEED: Contact[] = [
  { id: 'c01', orgId: DEMO_ORG_ID, firstName: 'Alice',   lastName: 'Johnson',   email: 'alice@techcorp.io',     phone: '+1-555-0101', company: 'TechCorp',     status: 'customer', tags: ['vip', 'saas'],    ownerId: DEMO_USER_ID, createdAt: daysAgo(120), updatedAt: daysAgo(5) },
  { id: 'c02', orgId: DEMO_ORG_ID, firstName: 'Bob',     lastName: 'Martinez',  email: 'bob@finex.com',         phone: '+1-555-0102', company: 'Finex',        status: 'prospect', tags: ['finance'],        ownerId: DEMO_USER_ID, createdAt: daysAgo(90),  updatedAt: daysAgo(3) },
  { id: 'c03', orgId: DEMO_ORG_ID, firstName: 'Carol',   lastName: 'Lee',       email: 'carol@healthplus.org',  phone: '+1-555-0103', company: 'HealthPlus',   status: 'lead',     tags: ['healthcare'],     ownerId: DEMO_USER_ID, createdAt: daysAgo(60),  updatedAt: daysAgo(2) },
  { id: 'c04', orgId: DEMO_ORG_ID, firstName: 'David',   lastName: 'Patel',     email: 'david@retailco.com',    phone: '+1-555-0104', company: 'RetailCo',     status: 'customer', tags: ['retail', 'vip'],  ownerId: DEMO_USER_ID, createdAt: daysAgo(200), updatedAt: daysAgo(10) },
  { id: 'c05', orgId: DEMO_ORG_ID, firstName: 'Eve',     lastName: 'Thompson',  email: 'eve@startup.xyz',                            company: 'Startup XYZ',  status: 'lead',                               ownerId: DEMO_USER_ID, createdAt: daysAgo(15),  updatedAt: daysAgo(1) },
  { id: 'c06', orgId: DEMO_ORG_ID, firstName: 'Frank',   lastName: 'Nguyen',    email: 'frank@megacorp.com',    phone: '+1-555-0106', company: 'MegaCorp',     status: 'prospect', tags: ['enterprise'],     ownerId: DEMO_USER_ID, createdAt: daysAgo(45),  updatedAt: daysAgo(4) },
  { id: 'c07', orgId: DEMO_ORG_ID, firstName: 'Grace',   lastName: 'Kim',       email: 'grace@agencyb.io',      phone: '+1-555-0107', company: 'Agency B',     status: 'churned',  tags: ['agency'],         ownerId: DEMO_USER_ID, createdAt: daysAgo(300), updatedAt: daysAgo(60) },
  { id: 'c08', orgId: DEMO_ORG_ID, firstName: 'Hank',    lastName: 'Williams',  email: 'hank@edtech.co',        phone: '+1-555-0108', company: 'EdTech',       status: 'customer', tags: ['education'],      ownerId: DEMO_USER_ID, createdAt: daysAgo(130), updatedAt: daysAgo(7) },
  { id: 'c09', orgId: DEMO_ORG_ID, firstName: 'Iris',    lastName: 'Gomez',     email: 'iris@legalfirm.com',                         company: 'Legal Firm',   status: 'lead',                               ownerId: DEMO_USER_ID, createdAt: daysAgo(20),  updatedAt: daysAgo(1) },
  { id: 'c10', orgId: DEMO_ORG_ID, firstName: 'James',   lastName: 'Brown',     email: 'james@cloudhost.net',   phone: '+1-555-0110', company: 'CloudHost',    status: 'prospect', tags: ['cloud'],          ownerId: DEMO_USER_ID, createdAt: daysAgo(55),  updatedAt: daysAgo(6) },
  { id: 'c11', orgId: DEMO_ORG_ID, firstName: 'Karen',   lastName: 'Wilson',    email: 'karen@biotech.org',     phone: '+1-555-0111', company: 'BioTech',      status: 'customer', tags: ['life-science'],   ownerId: DEMO_USER_ID, createdAt: daysAgo(180), updatedAt: daysAgo(14) },
  { id: 'c12', orgId: DEMO_ORG_ID, firstName: 'Liam',    lastName: 'Scott',     email: 'liam@proptech.io',                           company: 'PropTech',     status: 'lead',                               ownerId: DEMO_USER_ID, createdAt: daysAgo(8),   updatedAt: daysAgo(1) },
  { id: 'c13', orgId: DEMO_ORG_ID, firstName: 'Maria',   lastName: 'Chen',      email: 'maria@e-shop.com',      phone: '+1-555-0113', company: 'E-Shop',       status: 'customer', tags: ['ecommerce'],      ownerId: DEMO_USER_ID, createdAt: daysAgo(220), updatedAt: daysAgo(3) },
  { id: 'c14', orgId: DEMO_ORG_ID, firstName: 'Nathan',  lastName: 'Davis',     email: 'nathan@govagency.gov',  phone: '+1-555-0114', company: 'Gov Agency',   status: 'prospect', tags: ['government'],     ownerId: DEMO_USER_ID, createdAt: daysAgo(70),  updatedAt: daysAgo(8) },
  { id: 'c15', orgId: DEMO_ORG_ID, firstName: 'Olivia',  lastName: 'Taylor',    email: 'olivia@mediagrp.com',   phone: '+1-555-0115', company: 'Media Group',  status: 'churned',  tags: ['media'],          ownerId: DEMO_USER_ID, createdAt: daysAgo(280), updatedAt: daysAgo(90) },
]

const contactMap = new Map<string, Contact>(CONTACTS_SEED.map((c) => [c.id, c]))

// ─── Seed: Deals ─────────────────────────────────────────────────────────────

const DEALS_SEED: Deal[] = [
  { id: 'd01', orgId: DEMO_ORG_ID, title: 'TechCorp Enterprise Renewal',  value: 48000, currency: 'USD', stageId: 's4', pipelineId: PIPELINE_IDS[0], contactId: 'c01', ownerId: DEMO_USER_ID, closeDate: daysFromNow(14), status: 'open',  createdAt: daysAgo(30), updatedAt: daysAgo(2) },
  { id: 'd02', orgId: DEMO_ORG_ID, title: 'Finex Platform Expansion',     value: 22000, currency: 'USD', stageId: 's3', pipelineId: PIPELINE_IDS[0], contactId: 'c02', ownerId: DEMO_USER_ID, closeDate: daysFromNow(30), status: 'open',  createdAt: daysAgo(20), updatedAt: daysAgo(1) },
  { id: 'd03', orgId: DEMO_ORG_ID, title: 'HealthPlus Initial Deal',      value: 9500,  currency: 'USD', stageId: 's1', pipelineId: PIPELINE_IDS[0], contactId: 'c03', ownerId: DEMO_USER_ID, closeDate: daysFromNow(60), status: 'open',  createdAt: daysAgo(10), updatedAt: daysAgo(1) },
  { id: 'd04', orgId: DEMO_ORG_ID, title: 'RetailCo Pro Upgrade',         value: 15000, currency: 'USD', stageId: 's5', pipelineId: PIPELINE_IDS[0], contactId: 'c04', ownerId: DEMO_USER_ID, closeDate: daysAgo(5),     status: 'won',   notes: 'Signed contract', createdAt: daysAgo(60), updatedAt: daysAgo(5) },
  { id: 'd05', orgId: DEMO_ORG_ID, title: 'MegaCorp Global License',      value: 95000, currency: 'USD', stageId: 'e3', pipelineId: PIPELINE_IDS[1], contactId: 'c06', ownerId: DEMO_USER_ID, closeDate: daysFromNow(45), status: 'open',  createdAt: daysAgo(40), updatedAt: daysAgo(3) },
  { id: 'd06', orgId: DEMO_ORG_ID, title: 'CloudHost API Bundle',         value: 7200,  currency: 'USD', stageId: 's2', pipelineId: PIPELINE_IDS[0], contactId: 'c10', ownerId: DEMO_USER_ID, closeDate: daysFromNow(21), status: 'open',  createdAt: daysAgo(12), updatedAt: daysAgo(2) },
  { id: 'd07', orgId: DEMO_ORG_ID, title: 'BioTech Annual Contract',      value: 31000, currency: 'USD', stageId: 'e4', pipelineId: PIPELINE_IDS[1], contactId: 'c11', ownerId: DEMO_USER_ID, closeDate: daysFromNow(7),  status: 'open',  createdAt: daysAgo(55), updatedAt: daysAgo(1) },
  { id: 'd08', orgId: DEMO_ORG_ID, title: 'Agency B Subscription',        value: 4800,  currency: 'USD', stageId: 's3', pipelineId: PIPELINE_IDS[0], contactId: 'c07', ownerId: DEMO_USER_ID, closeDate: daysAgo(30),    status: 'lost',  notes: 'Budget cut', createdAt: daysAgo(80), updatedAt: daysAgo(30) },
  { id: 'd09', orgId: DEMO_ORG_ID, title: 'Partner Portal - Agency B',    value: 12000, currency: 'USD', stageId: 'p2', pipelineId: PIPELINE_IDS[2], contactId: 'c07', ownerId: DEMO_USER_ID, closeDate: daysFromNow(20), status: 'open',  createdAt: daysAgo(18), updatedAt: daysAgo(2) },
  { id: 'd10', orgId: DEMO_ORG_ID, title: 'Gov Agency Pilot',             value: 18500, currency: 'USD', stageId: 'e1', pipelineId: PIPELINE_IDS[1], contactId: 'c14', ownerId: DEMO_USER_ID, closeDate: daysFromNow(90), status: 'open',  createdAt: daysAgo(6),  updatedAt: daysAgo(1) },
]

const dealMap = new Map<string, Deal>(DEALS_SEED.map((d) => [d.id, d]))

// ─── Seed: Activities (kept in memory, exposed via useCrmStore.createActivity) ──

// ─── Seed: Segments ───────────────────────────────────────────────────────────

const segmentMap = new Map<string, Segment>([
  ['seg-01', {
    id: 'seg-01', orgId: DEMO_ORG_ID, name: 'Active Customers',
    filters: [{ field: 'status', operator: 'is', value: 'customer' }],
    contactCount: 5, createdAt: daysAgo(100), updatedAt: daysAgo(1),
  }],
  ['seg-02', {
    id: 'seg-02', orgId: DEMO_ORG_ID, name: 'High-Value Leads',
    filters: [
      { field: 'status',         operator: 'is',  value: 'lead' },
      { field: 'dealValue',      operator: 'gt',  value: 10000 },
    ],
    contactCount: 3, createdAt: daysAgo(80), updatedAt: daysAgo(4),
  }],
  ['seg-03', {
    id: 'seg-03', orgId: DEMO_ORG_ID, name: 'Churned — Win-back',
    filters: [{ field: 'status', operator: 'is', value: 'churned' }],
    contactCount: 2, createdAt: daysAgo(60), updatedAt: daysAgo(2),
  }],
])

// ─── Seed: Campaigns ─────────────────────────────────────────────────────────

const campaignMap = new Map<string, Campaign>([
  ['camp-01', {
    id: 'camp-01', orgId: DEMO_ORG_ID, name: 'Q2 Product Launch',
    type: 'email', status: 'sent', segmentId: 'seg-01',
    subject: 'Introducing our biggest update yet', body: 'Hi {{firstName}}, we just launched…',
    sentAt: daysAgo(14),
    stats: { sent: 1420, opened: 618, clicked: 204, bounced: 31 },
    createdAt: daysAgo(20), updatedAt: daysAgo(14),
  }],
  ['camp-02', {
    id: 'camp-02', orgId: DEMO_ORG_ID, name: 'Win-back Offer',
    type: 'email', status: 'sent', segmentId: 'seg-03',
    subject: 'We miss you — here\'s 20% off', body: 'Come back, {{firstName}}…',
    sentAt: daysAgo(7),
    stats: { sent: 205, opened: 88, clicked: 34, bounced: 8 },
    createdAt: daysAgo(12), updatedAt: daysAgo(7),
  }],
  ['camp-03', {
    id: 'camp-03', orgId: DEMO_ORG_ID, name: 'Summer Newsletter',
    type: 'email', status: 'scheduled', segmentId: 'seg-01',
    subject: 'Summer updates from Acme', body: 'Hello {{firstName}}, this summer…',
    scheduledAt: daysFromNow(3),
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  }],
  ['camp-04', {
    id: 'camp-04', orgId: DEMO_ORG_ID, name: 'SMS Flash Sale',
    type: 'sms', status: 'draft',
    body: '⚡ 24h only: 30% off. Claim at vytal.io/flash',
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  }],
  ['camp-05', {
    id: 'camp-05', orgId: DEMO_ORG_ID, name: 'Push: New Feature Alert',
    type: 'push', status: 'paused', segmentId: 'seg-01',
    subject: 'New feature live!', body: 'Tap to see what\'s new in Vytal.',
    createdAt: daysAgo(5), updatedAt: daysAgo(3),
  }],
])

// ─── Seed: Sequences ─────────────────────────────────────────────────────────

const SEQ_STEPS_1: SequenceStep[] = [
  { id: 'ss-1-1', sequenceId: 'seq-01', position: 0, type: 'email',     subject: 'Welcome to Acme!',         body: 'Hi {{firstName}}, thanks for signing up…' },
  { id: 'ss-1-2', sequenceId: 'seq-01', position: 1, type: 'wait',      delayHours: 48 },
  { id: 'ss-1-3', sequenceId: 'seq-01', position: 2, type: 'email',     subject: 'Getting started guide',    body: 'Here are 3 things to try first…' },
  { id: 'ss-1-4', sequenceId: 'seq-01', position: 3, type: 'wait',      delayHours: 72 },
  { id: 'ss-1-5', sequenceId: 'seq-01', position: 4, type: 'condition' },
  { id: 'ss-1-6', sequenceId: 'seq-01', position: 5, type: 'email',     subject: 'How can we help?',         body: 'Hey {{firstName}}, just checking in…' },
]

const SEQ_STEPS_2: SequenceStep[] = [
  { id: 'ss-2-1', sequenceId: 'seq-02', position: 0, type: 'email',     subject: 'We noticed you left…',     body: 'Hi {{firstName}}, your trial ended…' },
  { id: 'ss-2-2', sequenceId: 'seq-02', position: 1, type: 'wait',      delayHours: 24 },
  { id: 'ss-2-3', sequenceId: 'seq-02', position: 2, type: 'email',     subject: 'Last chance to save 20%',  body: 'Hi {{firstName}}, use code BACK20…' },
]

const sequenceMap = new Map<string, Sequence>([
  ['seq-01', {
    id: 'seq-01', orgId: DEMO_ORG_ID, name: 'New Lead Onboarding',
    status: 'active', triggerEvent: 'contact.created',
    steps: SEQ_STEPS_1, createdAt: daysAgo(60),
  }],
  ['seq-02', {
    id: 'seq-02', orgId: DEMO_ORG_ID, name: 'Churn Win-back',
    status: 'paused', triggerEvent: 'contact.churned',
    steps: SEQ_STEPS_2, createdAt: daysAgo(30),
  }],
])

// ─── Seed: Tickets ───────────────────────────────────────────────────────────

function makeMsg(id: string, ticketId: string, body: string, authorId: string | undefined, isInternal: boolean, createdAt: Date): TicketMessage {
  return { id, ticketId, body, authorId, isInternal, createdAt }
}

const ticketMap = new Map<string, Ticket>([
  ['t01', {
    id: 't01', orgId: DEMO_ORG_ID, subject: 'Cannot export reports',
    description: 'The export button does not respond when I click it.',
    status: 'open', priority: 'high', contactId: 'c01', assigneeId: DEMO_USER_ID,
    tags: ['bug', 'export'], slaDueAt: daysFromNow(1),
    messages: [
      makeMsg('tm-01-1', 't01', 'Cannot export reports, please help!', 'c01', false, daysAgo(2)),
      makeMsg('tm-01-2', 't01', 'Assigned to support team.',           DEMO_USER_ID, true,  daysAgo(2)),
    ],
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  }],
  ['t02', {
    id: 't02', orgId: DEMO_ORG_ID, subject: 'Billing inquiry — double charge',
    description: 'I was charged twice for the same invoice.',
    status: 'pending', priority: 'urgent', contactId: 'c04', assigneeId: DEMO_USER_ID,
    tags: ['billing'], slaDueAt: daysFromNow(0),
    messages: [
      makeMsg('tm-02-1', 't02', 'I see two charges on my card.',      'c04',         false, daysAgo(1)),
      makeMsg('tm-02-2', 't02', 'Checking with billing team now.',    DEMO_USER_ID,  true,  daysAgo(1)),
    ],
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  }],
  ['t03', {
    id: 't03', orgId: DEMO_ORG_ID, subject: 'How to set up SSO?',
    description: 'Looking for a guide on configuring SAML SSO.',
    status: 'resolved', priority: 'medium', contactId: 'c06', assigneeId: DEMO_USER_ID,
    tags: ['sso', 'question'], resolvedAt: daysAgo(3),
    messages: [
      makeMsg('tm-03-1', 't03', 'Please find the SSO guide here: …', DEMO_USER_ID,  false, daysAgo(4)),
    ],
    createdAt: daysAgo(5), updatedAt: daysAgo(3),
  }],
  ['t04', {
    id: 't04', orgId: DEMO_ORG_ID, subject: 'API rate limit errors',
    description: 'Getting 429 errors during import.',
    status: 'open', priority: 'high', contactId: 'c10',
    tags: ['api', 'bug'], slaDueAt: daysFromNow(2),
    messages: [
      makeMsg('tm-04-1', 't04', 'Error: 429 Too Many Requests.',     'c10',         false, daysAgo(1)),
    ],
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  }],
  ['t05', {
    id: 't05', orgId: DEMO_ORG_ID, subject: 'Feature request: dark mode',
    description: 'Would love a dark theme option.',
    status: 'closed', priority: 'low', contactId: 'c08',
    tags: ['feature-request'],
    messages: [
      makeMsg('tm-05-1', 't05', 'Logged to product backlog, thanks!', DEMO_USER_ID, false, daysAgo(10)),
    ],
    createdAt: daysAgo(12), updatedAt: daysAgo(10),
  }],
  ['t06', {
    id: 't06', orgId: DEMO_ORG_ID, subject: 'Data import failing for large CSV',
    description: 'CSV imports over 10MB time out.',
    status: 'open', priority: 'medium', contactId: 'c11', assigneeId: DEMO_USER_ID,
    tags: ['import', 'bug'], slaDueAt: daysFromNow(3),
    messages: [],
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  }],
  ['t07', {
    id: 't07', orgId: DEMO_ORG_ID, subject: 'Password reset not arriving',
    description: 'Reset email never arrives.',
    status: 'pending', priority: 'medium', contactId: 'c13', assigneeId: DEMO_USER_ID,
    tags: ['auth'], slaDueAt: daysFromNow(1),
    messages: [
      makeMsg('tm-07-1', 't07', 'Please check your spam folder.',    DEMO_USER_ID,  false, daysAgo(1)),
    ],
    createdAt: daysAgo(2), updatedAt: daysAgo(1),
  }],
  ['t08', {
    id: 't08', orgId: DEMO_ORG_ID, subject: 'Slow dashboard load time',
    description: 'Dashboard takes 15+ seconds to load.',
    status: 'open', priority: 'urgent', contactId: 'c02', assigneeId: DEMO_USER_ID,
    tags: ['performance'], slaDueAt: daysFromNow(0),
    messages: [
      makeMsg('tm-08-1', 't08', 'Repro confirmed, investigating.',   DEMO_USER_ID,  true,  daysAgo(1)),
    ],
    createdAt: daysAgo(1), updatedAt: daysAgo(1),
  }],
])

// ─── Filter helper ────────────────────────────────────────────────────────────

function applyListParams<T>(items: T[], params?: ListParams): T[] {
  let result = [...items]
  if (params?.search) {
    const q = params.search.toLowerCase()
    result = result.filter((item) =>
      Object.values(item as Record<string, unknown>).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(q),
      ),
    )
  }
  const limit = params?.limit ?? 100
  const page  = params?.page  ?? 1
  const start = (page - 1) * limit
  return result.slice(start, start + limit)
}

// ─── Seed: KB Categories ──────────────────────────────────────────────────────

const kbCategoryMap = new Map<string, KbCategory>([
  ['kbc-01', {
    id: 'kbc-01', orgId: DEMO_ORG_ID, name: 'Getting Started',
    slug: 'getting-started', description: 'Learn the basics and get up and running quickly.',
    position: 0, articleCount: 4, createdAt: daysAgo(60),
  }],
  ['kbc-02', {
    id: 'kbc-02', orgId: DEMO_ORG_ID, name: 'Product Guide',
    slug: 'product-guide', description: 'In-depth documentation for every feature.',
    position: 1, articleCount: 3, createdAt: daysAgo(55),
  }],
  ['kbc-03', {
    id: 'kbc-03', orgId: DEMO_ORG_ID, name: 'Troubleshooting',
    slug: 'troubleshooting', description: 'Solutions to common issues and errors.',
    position: 2, articleCount: 3, createdAt: daysAgo(50),
  }],
])

// ─── Seed: KB Articles ────────────────────────────────────────────────────────

const kbArticleMap = new Map<string, KbArticle>([
  ['kba-01', {
    id: 'kba-01', orgId: DEMO_ORG_ID, categoryId: 'kbc-01',
    title: 'Welcome to Vytal',
    slug: 'welcome-to-vytal',
    body: 'Welcome to Vytal — the all-in-one CRM platform.\n\nThis guide walks you through the core modules:\n\n1. Sales — manage contacts, deals, and pipelines\n2. Marketing — run campaigns and sequences\n3. Service — handle customer support tickets\n4. Knowledge Base — publish help articles\n\nStart by visiting the Dashboard to see your overview.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 342,
    createdAt: daysAgo(58), updatedAt: daysAgo(10),
  }],
  ['kba-02', {
    id: 'kba-02', orgId: DEMO_ORG_ID, categoryId: 'kbc-01',
    title: 'Setting Up Your Account',
    slug: 'setting-up-your-account',
    body: 'Follow these steps to set up your Vytal account:\n\n1. Complete your organization profile in Settings\n2. Invite team members from the Members tab\n3. Connect your email provider\n4. Import your existing contacts via CSV\n\nOnce setup is complete, you are ready to start managing your customers.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 215,
    createdAt: daysAgo(55), updatedAt: daysAgo(8),
  }],
  ['kba-03', {
    id: 'kba-03', orgId: DEMO_ORG_ID, categoryId: 'kbc-01',
    title: 'Importing Contacts from CSV',
    slug: 'importing-contacts-from-csv',
    body: 'You can bulk import contacts using a CSV file.\n\nRequired columns:\n- first_name\n- last_name\n- email\n\nOptional columns: phone, company, status, tags\n\nTo import:\n1. Go to Sales > Contacts\n2. Click "Import CSV"\n3. Map columns to Vytal fields\n4. Confirm and import\n\nDuplicate emails are automatically merged.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 178,
    createdAt: daysAgo(50), updatedAt: daysAgo(5),
  }],
  ['kba-04', {
    id: 'kba-04', orgId: DEMO_ORG_ID, categoryId: 'kbc-01',
    title: 'Connecting Your Email',
    slug: 'connecting-your-email',
    body: 'Draft: Detailed steps for connecting Gmail, Outlook, and custom SMTP providers. Coming soon.',
    status: 'draft', authorId: DEMO_USER_ID, viewCount: 0,
    createdAt: daysAgo(5), updatedAt: daysAgo(5),
  }],
  ['kba-05', {
    id: 'kba-05', orgId: DEMO_ORG_ID, categoryId: 'kbc-02',
    title: 'Managing Deals and Pipelines',
    slug: 'managing-deals-and-pipelines',
    body: 'Pipelines in Vytal represent your sales process.\n\nEach pipeline has stages. Deals move through stages as they progress.\n\nTo create a deal:\n1. Go to Sales > Pipeline\n2. Click "+ New Deal" on any stage\n3. Fill in title, value, and close date\n\nDeals can be marked as Won or Lost at any time using the status dropdown.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 130,
    createdAt: daysAgo(45), updatedAt: daysAgo(3),
  }],
  ['kba-06', {
    id: 'kba-06', orgId: DEMO_ORG_ID, categoryId: 'kbc-02',
    title: 'Running Email Campaigns',
    slug: 'running-email-campaigns',
    body: 'Email campaigns let you send bulk messages to contact segments.\n\nSteps:\n1. Create a segment to define your audience\n2. Go to Marketing > Campaigns\n3. Click "+ New Campaign"\n4. Choose type: Email, SMS, or Push\n5. Write your subject and body\n6. Schedule or send immediately\n\nYou can track opens, clicks, and bounces in the campaign stats panel.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 97,
    createdAt: daysAgo(40), updatedAt: daysAgo(2),
  }],
  ['kba-07', {
    id: 'kba-07', orgId: DEMO_ORG_ID, categoryId: 'kbc-02',
    title: 'Using Automation Sequences',
    slug: 'using-automation-sequences',
    body: 'Draft: How to build multi-step drip sequences with wait steps and conditions.',
    status: 'draft', authorId: DEMO_USER_ID, viewCount: 0,
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  }],
  ['kba-08', {
    id: 'kba-08', orgId: DEMO_ORG_ID, categoryId: 'kbc-03',
    title: 'Fixing CSV Import Errors',
    slug: 'fixing-csv-import-errors',
    body: 'Common CSV import errors and how to fix them:\n\n**Missing required columns**\nEnsure first_name, last_name, and email columns are present.\n\n**Invalid email format**\nCheck that all email values follow the format user@domain.com.\n\n**File too large**\nFiles larger than 10MB may time out. Split your file into smaller batches.\n\n**Encoding issues**\nSave your CSV as UTF-8 to avoid special character problems.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 88,
    createdAt: daysAgo(38), updatedAt: daysAgo(4),
  }],
  ['kba-09', {
    id: 'kba-09', orgId: DEMO_ORG_ID, categoryId: 'kbc-03',
    title: 'API Rate Limit Troubleshooting',
    slug: 'api-rate-limit-troubleshooting',
    body: 'If you are receiving 429 Too Many Requests errors:\n\n1. Check your request rate — the API allows 100 requests per minute per org\n2. Implement exponential backoff in your integration\n3. Use batch endpoints where available\n4. Cache responses to reduce redundant calls\n\nContact support if you need a higher rate limit for your plan.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 64,
    createdAt: daysAgo(30), updatedAt: daysAgo(2),
  }],
  ['kba-10', {
    id: 'kba-10', orgId: DEMO_ORG_ID, categoryId: 'kbc-03',
    title: 'Password Reset Issues',
    slug: 'password-reset-issues',
    body: 'Not receiving your password reset email?\n\n1. Check your spam or junk folder\n2. Ensure you entered the correct email address\n3. Wait up to 5 minutes for delivery\n4. Try the "Resend" button on the reset page\n\nIf the issue persists, contact your organization admin or reach out to support.',
    status: 'published', authorId: DEMO_USER_ID, viewCount: 55,
    createdAt: daysAgo(25), updatedAt: daysAgo(1),
  }],
])

// ─── MockApiClient ────────────────────────────────────────────────────────────

class MockApiClient {
  // ─── Contacts ────────────────────────────────────────────────────────────

  contacts = {
    list: (params?: ListParams): Promise<Contact[]> =>
      resolve(applyListParams(Array.from(contactMap.values()), params)),

    get: (id: string): Promise<Contact> => {
      const c = contactMap.get(id)
      if (!c) return Promise.reject(new Error(`Contact ${id} not found`))
      return resolve(c)
    },

    create: (data: Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Contact> => {
      const now = new Date()
      const c: Contact = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: now, updatedAt: now }
      contactMap.set(c.id, c)
      return resolve(c)
    },

    update: (id: string, data: Partial<Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Contact> => {
      const existing = contactMap.get(id)
      if (!existing) return Promise.reject(new Error(`Contact ${id} not found`))
      const updated: Contact = { ...existing, ...data, updatedAt: new Date() }
      contactMap.set(id, updated)
      return resolve(updated)
    },

    delete: (id: string): Promise<void> => {
      contactMap.delete(id)
      return resolve(undefined)
    },
  }

  // ─── Deals ───────────────────────────────────────────────────────────────

  deals = {
    list: (params?: ListParams): Promise<Deal[]> =>
      resolve(applyListParams(Array.from(dealMap.values()), params)),

    get: (id: string): Promise<Deal> => {
      const d = dealMap.get(id)
      if (!d) return Promise.reject(new Error(`Deal ${id} not found`))
      return resolve(d)
    },

    create: (data: Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Deal> => {
      const now = new Date()
      const d: Deal = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: now, updatedAt: now }
      dealMap.set(d.id, d)
      return resolve(d)
    },

    update: (id: string, data: Partial<Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Deal> => {
      const existing = dealMap.get(id)
      if (!existing) return Promise.reject(new Error(`Deal ${id} not found`))
      const updated: Deal = { ...existing, ...data, updatedAt: new Date() }
      dealMap.set(id, updated)
      return resolve(updated)
    },
  }

  // ─── Pipelines ───────────────────────────────────────────────────────────

  pipelines = {
    list: (): Promise<Pipeline[]> =>
      resolve(Array.from(pipelineMap.values())),

    create: (data: Omit<Pipeline, 'id' | 'orgId' | 'createdAt'>): Promise<Pipeline> => {
      const p: Pipeline = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: new Date() }
      pipelineMap.set(p.id, p)
      return resolve(p)
    },

    addStage: (pipelineId: string, data: Omit<Stage, 'id'>): Promise<Stage> => {
      const pipeline = pipelineMap.get(pipelineId)
      if (!pipeline) return Promise.reject(new Error(`Pipeline ${pipelineId} not found`))
      const stage: Stage = { ...data, id: uid() }
      pipeline.stages.push(stage)
      stageMap.set(stage.id, stage)
      return resolve(stage)
    },
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────

  campaigns = {
    list: (): Promise<Campaign[]> =>
      resolve(Array.from(campaignMap.values())),

    get: (id: string): Promise<Campaign> => {
      const c = campaignMap.get(id)
      if (!c) return Promise.reject(new Error(`Campaign ${id} not found`))
      return resolve(c)
    },

    create: (data: Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Campaign> => {
      const now = new Date()
      const c: Campaign = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: now, updatedAt: now }
      campaignMap.set(c.id, c)
      return resolve(c)
    },

    update: (id: string, data: Partial<Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Campaign> => {
      const existing = campaignMap.get(id)
      if (!existing) return Promise.reject(new Error(`Campaign ${id} not found`))
      const updated: Campaign = { ...existing, ...data, updatedAt: new Date() }
      campaignMap.set(id, updated)
      return resolve(updated)
    },

    delete: (id: string): Promise<void> => {
      campaignMap.delete(id)
      return resolve(undefined)
    },
  }

  // ─── Segments ────────────────────────────────────────────────────────────

  segments = {
    list: (): Promise<Segment[]> =>
      resolve(Array.from(segmentMap.values())),

    create: (data: Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Segment> => {
      const now = new Date()
      const s: Segment = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: now, updatedAt: now }
      segmentMap.set(s.id, s)
      return resolve(s)
    },

    update: (id: string, data: Partial<Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Segment> => {
      const existing = segmentMap.get(id)
      if (!existing) return Promise.reject(new Error(`Segment ${id} not found`))
      const updated: Segment = { ...existing, ...data, updatedAt: new Date() }
      segmentMap.set(id, updated)
      return resolve(updated)
    },

    delete: (id: string): Promise<void> => {
      segmentMap.delete(id)
      return resolve(undefined)
    },
  }

  // ─── Tickets ─────────────────────────────────────────────────────────────

  tickets = {
    list: (params?: ListParams): Promise<Ticket[]> =>
      resolve(applyListParams(Array.from(ticketMap.values()), params)),

    get: (id: string): Promise<Ticket> => {
      const t = ticketMap.get(id)
      if (!t) return Promise.reject(new Error(`Ticket ${id} not found`))
      return resolve(t)
    },

    create: (data: Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Ticket> => {
      const now = new Date()
      const t: Ticket = { ...data, orgId: DEMO_ORG_ID, id: uid(), messages: data.messages ?? [], createdAt: now, updatedAt: now }
      ticketMap.set(t.id, t)
      return resolve(t)
    },

    update: (id: string, data: Partial<Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Ticket> => {
      const existing = ticketMap.get(id)
      if (!existing) return Promise.reject(new Error(`Ticket ${id} not found`))
      const updated: Ticket = { ...existing, ...data, updatedAt: new Date() }
      ticketMap.set(id, updated)
      return resolve(updated)
    },

    addMessage: (id: string, body: string, isInternal: boolean): Promise<TicketMessage> => {
      const ticket = ticketMap.get(id)
      if (!ticket) return Promise.reject(new Error(`Ticket ${id} not found`))
      const msg: TicketMessage = {
        id: uid(), ticketId: id, body, authorId: DEMO_USER_ID,
        isInternal, createdAt: new Date(),
      }
      const messages = [...(ticket.messages ?? []), msg]
      ticketMap.set(id, { ...ticket, messages, updatedAt: new Date() })
      return resolve(msg)
    },
  }

  // ─── Knowledge Base ──────────────────────────────────────────────────────

  kb = {
    categories: {
      list: (): Promise<KbCategory[]> => {
        const cats = Array.from(kbCategoryMap.values())
        // Recompute article counts from the live article map
        return resolve(cats.map((cat) => ({
          ...cat,
          articleCount: Array.from(kbArticleMap.values()).filter((a) => a.categoryId === cat.id).length,
        })))
      },

      create: (data: Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>): Promise<KbCategory> => {
        const cat: KbCategory = {
          ...data,
          orgId: DEMO_ORG_ID,
          id: uid(),
          articleCount: 0,
          createdAt: new Date(),
        }
        kbCategoryMap.set(cat.id, cat)
        return resolve(cat)
      },

      update: (id: string, data: Partial<Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>>): Promise<KbCategory> => {
        const existing = kbCategoryMap.get(id)
        if (!existing) return Promise.reject(new Error(`Category ${id} not found`))
        const updated: KbCategory = { ...existing, ...data }
        kbCategoryMap.set(id, updated)
        return resolve(updated)
      },

      delete: (id: string): Promise<void> => {
        const hasPublished = Array.from(kbArticleMap.values()).some(
          (a) => a.categoryId === id && a.status === 'published',
        )
        if (hasPublished) return Promise.reject(new Error('Cannot delete category with published articles'))
        kbCategoryMap.delete(id)
        return resolve(undefined)
      },
    },

    articles: {
      list: (params?: ListParams & { categoryId?: string; status?: ArticleStatus }): Promise<KbArticle[]> => {
        let articles = Array.from(kbArticleMap.values())
        if (params?.categoryId) {
          articles = articles.filter((a) => a.categoryId === params.categoryId)
        }
        if (params?.status) {
          articles = articles.filter((a) => a.status === params.status)
        }
        if (params?.search) {
          const q = params.search.toLowerCase()
          articles = articles.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
        }
        return resolve(articles)
      },

      get: (id: string): Promise<KbArticle> => {
        const article = kbArticleMap.get(id)
        if (!article) return Promise.reject(new Error(`Article ${id} not found`))
        // Increment view count
        const updated = { ...article, viewCount: article.viewCount + 1 }
        kbArticleMap.set(id, updated)
        return resolve(updated)
      },

      create: (data: Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>): Promise<KbArticle> => {
        const now = new Date()
        const article: KbArticle = {
          ...data,
          orgId: DEMO_ORG_ID,
          id: uid(),
          viewCount: 0,
          createdAt: now,
          updatedAt: now,
        }
        kbArticleMap.set(article.id, article)
        return resolve(article)
      },

      update: (id: string, data: Partial<Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>>): Promise<KbArticle> => {
        const existing = kbArticleMap.get(id)
        if (!existing) return Promise.reject(new Error(`Article ${id} not found`))
        const updated: KbArticle = { ...existing, ...data, updatedAt: new Date() }
        kbArticleMap.set(id, updated)
        return resolve(updated)
      },

      delete: (id: string): Promise<void> => {
        kbArticleMap.delete(id)
        return resolve(undefined)
      },

      publish: (id: string): Promise<KbArticle> => {
        const existing = kbArticleMap.get(id)
        if (!existing) return Promise.reject(new Error(`Article ${id} not found`))
        const updated: KbArticle = { ...existing, status: 'published', updatedAt: new Date() }
        kbArticleMap.set(id, updated)
        return resolve(updated)
      },
    },
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  auth = {
    login: (_email: string, _password: string): Promise<AuthLoginResponse> =>
      resolve({ token: 'mock-token', user: DEMO_USER, org: DEMO_ORG }),

    register: (_orgName: string, _email: string, _name: string, _password: string): Promise<AuthRegisterResponse> =>
      resolve({ token: 'mock-token', user: DEMO_USER, org: DEMO_ORG }),

    me: (): Promise<MeResponse> =>
      resolve({ user: DEMO_USER, org: DEMO_ORG }),
  }

  // ─── Orgs ────────────────────────────────────────────────────────────────

  orgs = {
    get: (): Promise<Org> =>
      resolve(DEMO_ORG),

    update: (data: Partial<Omit<Org, 'id' | 'createdAt'>>): Promise<Org> => {
      Object.assign(DEMO_ORG, data)
      return resolve({ ...DEMO_ORG })
    },

    members: (): Promise<User[]> =>
      resolve([DEMO_USER]),
  }

  // ─── Sequences ───────────────────────────────────────────────────────────

  sequences = {
    list: (): Promise<Sequence[]> =>
      resolve(Array.from(sequenceMap.values())),

    create: (data: Omit<Sequence, 'id' | 'orgId' | 'createdAt'>): Promise<Sequence> => {
      const s: Sequence = { ...data, orgId: DEMO_ORG_ID, id: uid(), createdAt: new Date() }
      sequenceMap.set(s.id, s)
      return resolve(s)
    },

    addStep: (sequenceId: string, data: Omit<SequenceStep, 'id' | 'sequenceId'>): Promise<SequenceStep> => {
      const seq = sequenceMap.get(sequenceId)
      if (!seq) return Promise.reject(new Error(`Sequence ${sequenceId} not found`))
      const step: SequenceStep = { ...data, id: uid(), sequenceId }
      seq.steps.push(step)
      return resolve(step)
    },
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const mockApi = new MockApiClient()
