# Channel / Activity Capture — Backend Specification

Backend-only spec for turning inbound communication (starting with email,
also chat/call/SMS/manual) into structured CRM data: contacts, activities,
follow-up tasks, deal signals, and updates to existing records. This
document describes what's already implemented, and specifies the pieces
needed to fully satisfy the capability ("track emails → store as insight →
create follow-ups → update existing CRM records").

---

## 1. Goals

1. **Capture** communication from external channels (email first: Gmail,
   Outlook; also Slack, Teams, web forms, manual paste) into a durable,
   per-org record of raw content.
2. **Classify** each capture as coming from an external party (a
   prospect/customer/lead) vs. internal team chatter, since only
   external-party communication should drive CRM writes.
3. **Extract insight** — a structured summary (intent, sentiment, topics,
   people, action items, deal signals) — via AI, and persist it alongside
   the raw capture as the system of record for "what this communication
   means."
4. **Act on insight**:
   - Create/link contacts.
   - Create a logged `activity` (the communication itself).
   - Create follow-up `activity` tasks for action items.
   - Create or advance a `deal` when commercial signals are present.
   - **Update fields on an existing contact/deal** when the message
     reveals new or changed information (title change, new company,
     new phone, stage-relevant timeline) rather than only creating new
     records.
5. Keep steps 3–4 auditable and reversible: nothing is written to core CRM
   tables (`contacts`, `deals`, `activities`) without a traceable capture
   record, and low-confidence extractions require human acceptance before
   they touch CRM data.

### Non-goals

- Outbound send (composing/sending replies) — out of scope here.
- Real-time chat UI. This spec covers ingestion + extraction + write-back
  only.
- Full-text search / analytics over captured content.

---

## 2. Current architecture (as implemented)

Two pipelines exist today and this spec unifies/extends them.

### 2a. Lightweight event pipeline — `channel_events`

```
Webhook / embedded form
  → POST /api/ingest/:source?org_id=<uuid>          (server/routes/ingest.ts)
    → ChannelSourceAdapter.verify(req)               (server/lib/channels/adapters/*)
    → ChannelSourceAdapter.parse(body) → CapturedEvent
    → insert channel_events (status='pending')
    → resolveEvent()                                 (server/lib/channels/resolver.ts)
        → dedup contact by email/phone
        → insert or reuse contact
        → insert one `note` activity ("Channel capture via <source>")
        → update channel_events.status = resolved|duplicate
```

- Adapters: `web-form`, `gmail`, `outlook`, `slack`, `teams`
  (`server/lib/channels/adapters/*.ts`), registered in
  `server/lib/channels/index.ts`.
- No AI extraction, no insight object, no follow-up tasks, no record
  updates. This path exists for simple lead-capture (web forms) and for
  provider push-notification acknowledgement.
- **Gap**: `GmailAdapter.parse` and `OutlookAdapter.parse` only decode the
  *notification* (a message ID / historyId pointer) — they never fetch the
  actual message body. Today the Gmail/Outlook webhook handlers in
  `server/routes/integrations.ts` (`/integrations/webhook/gmail`,
  `/integrations/webhook/outlook`) just acknowledge the ping and return;
  there is no code that calls the Gmail/Graph API to retrieve the message.
  **This is the missing link for "track the emails" and is specified in
  §5.**

### 2b. Rich capture pipeline — `channel_captures`

```
POST /api/captures                (server/routes/captures.ts)
POST /api/captures/ingest         (webhook variant, 202 fire-and-forget)
  → insert channel_captures (status='raw', raw_content, metadata)
  → runProcessing()
      → load org contacts + open deals
      → processCapture()          (server/lib/captureProcessor.ts)
          → Claude (ANTHROPIC_API_KEY / ANTHROPIC_MODEL) extracts:
            summary, sentiment, intent, topics, contacts[],
            actionItems[], dealSignals[], keyPoints[]
          → server-side entity resolution: match extracted contacts/deals
            to existing CRM rows by email / name+company / title overlap
      → update channel_captures.status='ready', extraction=<json>,
        linked_contact_ids=[...]

POST /api/captures/:id/accept     (server/routes/captures.ts)
  → create any selected new contacts
  → create ONE `activity` for the communication itself
  → create one `task` activity per action item (if createTasks=true)
  → optionally create ONE deal from the first deal signal
  → channel_captures.status='accepted', linked_activity_id, linked_deal_ids

POST /api/captures/:id/dismiss    → status='dismissed'
POST /api/captures/:id/process    → re-run extraction
```

- Also reachable via provider webhooks in `server/routes/integrations.ts`
  (`createCaptureFromWebhook`) for Slack (fully wired — pulls the message
  text from the Slack event) and Gmail/Outlook (acked but not yet feeding
  real message content, per the gap above).
- `integrations` table stores OAuth tokens per org/provider
  (`server/db/schema.ts`), used for the connect/callback/sync routes in
  `server/routes/integrations.ts`.

### Data model (existing, `server/db/schema.ts`)

| Table | Purpose | Key fields |
|---|---|---|
| `channel_captures` | Universal capture record + AI insight | `channel_type`, `status` (`raw→processing→ready→accepted\|dismissed`), `raw_content`, `metadata` (from/to/cc/subject/date/...), `extraction` (jsonb insight, see §4), `linked_contact_ids[]`, `linked_deal_ids[]`, `linked_activity_id`, `accepted_at` |
| `channel_events` | Raw inbound events from source adapters | `source`, `external_id`, `status` (`pending→resolved\|duplicate\|failed`), `raw_payload`, `resolved_contact_id` |
| `integrations` | Connected provider OAuth accounts | `provider` (gmail/outlook/slack/teams), `access_token`, `refresh_token`, `token_expires_at`, `scope`, `config`, `status`, `last_synced_at` |
| `contacts` | CRM contact | `email`, `phone`, `company`, `status`, `tags[]`, `owner_id`, `source` |
| `deals` | CRM deal | `stage_id`, `pipeline_id`, `contact_id`, `value`, `status` |
| `activities` | Logged communication / task | `type` (`call\|email\|meeting\|task\|note`), `subject`, `description`, `contact_id`, `deal_id`, `due_at`, `completed_at` |

---

## 3. External-sender classification (new)

Only communication from outside the organization should drive CRM writes;
internal team emails/chats about a deal should not spawn duplicate
contacts or noisy activities.

**Rule** (applied at capture time, before AI extraction):

1. Resolve the org's owned email domain(s): the set of domains present in
   `users.email` for the org, plus an optional `organizations.config
   .owned_domains` override for orgs whose staff use multiple domains.
2. For an email capture, parse the `From` header (already present in
   `metadata.from`). If the sender's domain is **not** in the owned-domain
   set → `is_external = true`.
3. `is_external` is stored on `channel_captures.metadata.isExternal` and
   surfaced in the extraction as `extraction.direction: 'inbound_external'
   | 'internal'`.
4. Internal captures are still stored (for audit) but default to
   `status='dismissed'` automatically unless a user explicitly reprocesses
   them — they never auto-create contacts/activities.

This directly implements: *"if there is an email from an external email,
it should store the data as insight and create follow up actions."*

---

## 4. Insight schema (extends `CaptureExtraction`)

The `channel_captures.extraction` JSON **is** the insight object referenced
in the requirements. Current shape (`server/lib/captureProcessor.ts`) plus
the additions needed for record-update support (new fields marked ✳):

```ts
interface CaptureExtraction {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  intent: 'sales' | 'support' | 'feedback' | 'general' | 'onboarding';
  direction: 'inbound_external' | 'internal';        // ✳ new
  topics: string[];
  contacts: ExtractedContact[];
  actionItems: ExtractedActionItem[];
  dealSignals: ExtractedDealSignal[];
  keyPoints: string[];
  contactUpdates: ExtractedFieldUpdate[];             // ✳ new
}

interface ExtractedContact {
  name: string;
  email?: string;
  company?: string;
  role?: string;
  existingContactId?: string;   // set by server-side resolution
}

// ✳ new — a proposed change to an EXISTING contact/deal, derived from
// content that contradicts or extends what's on file (e.g. "I've moved to
// Acme Corp as VP Sales" when the CRM has an older company/title).
interface ExtractedFieldUpdate {
  entityType: 'contact' | 'deal';
  entityId: string;             // must match an existingContactId/existingDealId
  field: string;                // e.g. 'company', 'phone', 'status', 'stage_id'
  currentValue?: string;
  proposedValue: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;               // short quote/paraphrase of the evidence
}

interface ExtractedActionItem {
  description: string;
  owner?: string;
  dueHint?: string;
  completed: boolean;
}

interface ExtractedDealSignal {
  mentionedValue?: string;
  mentionedTimeline?: string;
  stageSuggestion?: string;
  existingDealId?: string;
}
```

The Claude prompt in `processCapture()` is extended with a rule block:

> - If the message states a change to an existing contact's company, title,
>   phone, or status (e.g. new employer, promotion, "no longer with the
>   company"), emit a `contactUpdates` entry with `confidence` reflecting
>   how explicit the statement is. Do not fabricate updates from
>   inference alone — only from direct statements.

---

## 5. Message-fetch service (new — closes the "track emails" gap)

Today the Gmail/Outlook webhooks only receive a *pointer* to a new
message; nothing fetches the body. Add a thin fetch layer so a webhook
ping turns into a real `channel_captures` row:

```
server/lib/channels/fetchers/gmail.ts
  fetchMessage(integration, externalId) → { from, to, cc, subject, date, body }
    - GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}
      Authorization: Bearer <integrations.access_token>
      (refresh via refresh_token if 401 / token_expires_at has passed)
    - decode MIME body, strip signatures/quoted history (best-effort)

server/lib/channels/fetchers/outlook.ts
  fetchMessage(integration, externalId) → same shape via Microsoft Graph
      GET https://graph.microsoft.com/v1.0/me/messages/{id}
```

Webhook handler change (`server/routes/integrations.ts`):

```
POST /integrations/webhook/gmail
  → verify()
  → look up active `integrations` row for this org/provider
  → fetchMessage(integration, messageId)
  → rawContent = GmailAdapter.buildRawContent(message)   // already exists
  → createCaptureFromWebhook(orgId, 'email', rawContent, {
       from, to, cc, subject, date, source: 'Gmail'
     })
```

Token refresh reuses the existing `access_token`/`refresh_token`/
`token_expires_at` columns on `integrations`; on refresh failure, set
`integrations.status = 'error'` so it surfaces in `GET /api/integrations`.

Gmail requires a one-time `users.watch()` call (Pub/Sub topic) per
connected mailbox — done once at `/integrations/gmail/connect` success,
alongside storing the token; Outlook requires a Graph subscription created
the same way. Both need periodic renewal (Gmail watch: 7 days; Graph
subscription: up to 3 days for mail) — a scheduled job renews subscriptions
before expiry using `integrations.last_synced_at` as the checkpoint.

---

## 6. Follow-up action creation

Already implemented in `POST /api/captures/:id/accept` (§2b, step 3):
one `activities` row of `type='task'` per `actionItems[]` entry, linked to
the resolved contact. Two refinements to fully match "create meaningful...
follow up actions":

1. **Populate `due_at`** — currently task activities are created with no
   due date. Parse `actionItems[].dueHint` (e.g. "by Friday", "next week")
   into a concrete `due_at` timestamp (simple relative-date parsing;
   fall back to `created_at + 3 days` when unparseable).
2. **Auto-accept for high-confidence external insight** — for
   `direction='inbound_external'` captures where extraction confidence is
   high (has a matched `existingContactId` and at least one action item),
   allow an org-level setting (`organizations.config.autoAcceptCaptures:
   boolean`) to run the accept flow automatically instead of waiting on a
   user click, so follow-ups exist immediately after the email is
   captured. Default `false` — opt-in per org.

---

## 7. Updating existing CRM records (new capability)

This is the capability not yet present: `accept()` today only *creates*
new contacts/deals or *links* to existing ones — it never writes new
information onto an existing row.

### New endpoint

```
POST /api/captures/:id/accept
  body: {
    createContactIndices: number[],
    createTasks: boolean,
    createDeal: boolean,
    applyUpdateIndices: number[]   // ✳ new — indices into extraction.contactUpdates to apply
  }
```

### Behavior (added as step in the existing accept handler,
`server/routes/captures.ts`)

```
for each idx in body.applyUpdateIndices:
  update = extraction.contactUpdates[idx]
  guard: update.entityId must be in capture.linked_contact_ids (or the
         deal must be in linked_deal_ids) — never write to an entity the
         capture didn't actually resolve to.
  if update.entityType === 'contact':
    UPDATE contacts SET [update.field] = update.proposedValue,
      updated_at = now() WHERE id = update.entityId AND org_id = auth.orgId
  if update.entityType === 'deal':
    UPDATE deals SET [update.field] = update.proposedValue,
      updated_at = now() WHERE id = update.entityId AND org_id = auth.orgId
  → also insert an `activities` note: "Updated <field> from <old> to <new>
    via <channel> capture" for auditability
```

Constraints:

- **Allow-list fields** per entity type (`contacts`: `company`, `phone`,
  `status`, `tags`, `notes`; `deals`: `stage_id`, `value`, `close_date`,
  `status`) — never allow arbitrary column writes from AI output.
- **`confidence: 'low'` updates are never auto-applied** and are excluded
  from `applyUpdateIndices` validation unless the user explicitly
  overrides — the UI (not covered here) would surface them for manual
  review the same way action items are surfaced today.
- Every applied update produces an audit `activities` row, so record
  changes made via channel capture are traceable back to the source
  capture (`channel_captures.id`) the same way `linked_activity_id` traces
  the primary communication log.
- Response of `accept()` gains `updatedFieldCount` alongside the existing
  `createdContactCount`, `createdTaskCount`, `createdDeal`.

---

## 8. API surface (summary)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/captures` | org | Create + auto-process a capture |
| `GET` | `/api/captures` | org | List captures (filter by status/channel_type) |
| `GET` | `/api/captures/:id` | org | Fetch one capture incl. `extraction` |
| `POST` | `/api/captures/:id/process` | org | Re-run AI extraction |
| `POST` | `/api/captures/:id/accept` | org | Materialize contacts/activities/tasks/deal + **field updates** |
| `POST` | `/api/captures/:id/dismiss` | org | Discard a capture |
| `POST` | `/api/captures/ingest` | org (API key) | Fire-and-forget webhook intake |
| `POST` | `/api/ingest/:source` | public + adapter-verified | Lightweight event intake (web forms, provider pings) |
| `GET` | `/api/integrations` | org | List connected provider accounts |
| `GET` | `/api/integrations/:provider/connect` | org | Start OAuth |
| `GET` | `/api/integrations/:provider/callback` | OAuth | Store tokens |
| `POST` | `/api/integrations/:provider/sync` | org | Manual pull trigger |
| `POST` | `/api/integrations/webhook/:provider` | signature-verified | Provider push → capture (extended per §5) |

---

## 9. Security & reliability

- Provider webhooks are verified before any DB write (`adapter.verify()`);
  Gmail via shared Pub/Sub token, Slack via signing secret, Outlook via
  echoed `validationToken` (production hardening: also verify Graph
  `clientState`).
- OAuth tokens live in `integrations.access_token`/`refresh_token`;
  refresh-on-expiry must happen server-side and never surface tokens to
  the client (existing `GET /integrations` already omits them from the
  select).
- All CRM writes are scoped by `org_id` on every query — no cross-org
  leakage.
- Ingestion is idempotent by `external_id` (`channel_events`) — duplicate
  provider redeliveries should not create duplicate contacts/activities;
  `channel_captures` should gain the same dedup key (`(org_id, source,
  external_id)`) once webhook-driven email capture (§5) is live, to
  prevent double-processing on Pub/Sub/Graph retry.
- AI extraction failures fall back to `status='raw'`/unchanged capture
  (already handled by the try/catch around `runProcessing`) rather than
  blocking ingestion — never let an LLM outage drop an email.

---

## 10. Open items / future work

- Attachment handling (documents referenced in an email) is out of scope
  here — `channel_type: 'document'` already exists for manual paste but
  no adapter extracts attachments from provider messages yet.
- Thread-level context (replying to prior captures on the same email
  thread) is not modeled — each message becomes an independent capture.
  A future `thread_id` column on `channel_captures` would let extraction
  consider prior turns.
- This spec assumes single-mailbox-per-org OAuth; shared/team inboxes
  and per-user mailbox connections are future work.
