// ---------------------------------------------------------------------------
// captureProcessor.ts — AI brain for Channel Capture
// All types defined locally; no imports from src/
// ---------------------------------------------------------------------------

export interface CrmContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  company?: string;
}

export interface CrmDeal {
  id: string;
  title: string;
  value: string | number;
}

// ---- Extraction shape (mirrors src/types/captures.ts) --------------------

export interface ExtractedContact {
  name: string;
  email?: string;
  company?: string;
  role?: string;
  existingContactId?: string;
}

export interface ExtractedActionItem {
  description: string;
  owner?: string;
  dueHint?: string;
  completed: boolean;
}

export interface ExtractedDealSignal {
  mentionedValue?: string;
  mentionedTimeline?: string;
  stageSuggestion?: string;
  existingDealId?: string;
}

export interface CaptureExtraction {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  intent: 'sales' | 'support' | 'feedback' | 'general' | 'onboarding';
  topics: string[];
  contacts: ExtractedContact[];
  actionItems: ExtractedActionItem[];
  dealSignals: ExtractedDealSignal[];
  keyPoints: string[];
}

// ---- Metadata (subset used by the processor) ----------------------------

export interface CaptureMetadata {
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  duration?: number;
  participants?: string[];
  fileName?: string;
  source?: string;
  date?: string;
}

// ---- Anthropic API response shape ---------------------------------------

interface AnthropicContent {
  type: string;
  text: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
}

// ---- Entity resolution helpers ------------------------------------------

function resolveContacts(
  extracted: ExtractedContact[],
  crmContacts: CrmContact[],
): ExtractedContact[] {
  return extracted.map((ec) => {
    // Match by email (exact, case-insensitive)
    if (ec.email) {
      const emailLower = ec.email.toLowerCase();
      const match = crmContacts.find(
        (c) => c.email && c.email.toLowerCase() === emailLower,
      );
      if (match) {
        return { ...ec, existingContactId: match.id };
      }
    }

    // Match by full name + company (case-insensitive)
    const nameLower = ec.name.toLowerCase();
    const companyLower = ec.company?.toLowerCase();

    const match = crmContacts.find((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const nameMatch = fullName === nameLower;
      if (!nameMatch) return false;
      if (companyLower && c.company) {
        return c.company.toLowerCase() === companyLower;
      }
      return nameMatch;
    });

    if (match) {
      return { ...ec, existingContactId: match.id };
    }

    return ec;
  });
}

function resolveDeals(
  signals: ExtractedDealSignal[],
  crmDeals: CrmDeal[],
  rawContent: string,
): ExtractedDealSignal[] {
  if (signals.length === 0 || crmDeals.length === 0) return signals;

  return signals.map((sig) => {
    // Try to find an existing deal by checking if its title words appear in the raw content
    const contentLower = rawContent.toLowerCase();
    const match = crmDeals.find((d) => {
      const words = d.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return words.length > 0 && words.some((w) => contentLower.includes(w));
    });

    if (match) {
      return { ...sig, existingDealId: match.id };
    }
    return sig;
  });
}

// ---- Main export ---------------------------------------------------------

export async function processCapture(
  rawContent: string,
  channelType: string,
  metadata: CaptureMetadata,
  contacts: CrmContact[],
  deals: CrmDeal[],
): Promise<CaptureExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured on server');
  }

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  // Build context lists for Claude
  const contactsList =
    contacts.length > 0
      ? contacts
          .map(
            (c) =>
              `- ID: ${c.id} | Name: ${c.firstName} ${c.lastName}` +
              (c.email ? ` | Email: ${c.email}` : '') +
              (c.company ? ` | Company: ${c.company}` : ''),
          )
          .join('\n')
      : '(none)';

  const dealsList =
    deals.length > 0
      ? deals
          .map(
            (d) =>
              `- ID: ${d.id} | Title: ${d.title} | Value: ${d.value}`,
          )
          .join('\n')
      : '(none)';

  const metaContext = Object.entries(metadata)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n');

  const prompt = `You are an AI assistant helping a CRM extract structured data from a ${channelType} conversation.

${metaContext ? `Metadata:\n${metaContext}\n\n` : ''}Existing CRM contacts (use their IDs to mark matches):
${contactsList}

Existing open deals (use their IDs to mark matches):
${dealsList}

---
RAW CONTENT:
${rawContent}
---

Analyze the content above and respond with ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "summary": "2-3 sentence summary of what was discussed",
  "sentiment": "positive|neutral|negative|urgent",
  "intent": "sales|support|feedback|general|onboarding",
  "topics": ["topic1", "topic2"],
  "contacts": [
    {
      "name": "Full Name",
      "email": "email@example.com or omit",
      "company": "Company or omit",
      "role": "Job title or omit",
      "existingContactId": "CRM contact ID only if matched, otherwise omit"
    }
  ],
  "actionItems": [
    {
      "description": "What needs to be done",
      "owner": "Person responsible or omit",
      "dueHint": "Due date hint or omit",
      "completed": false
    }
  ],
  "dealSignals": [
    {
      "mentionedValue": "$ amount mentioned or omit",
      "mentionedTimeline": "Timeline mentioned or omit",
      "stageSuggestion": "Suggested deal stage or omit",
      "existingDealId": "CRM deal ID only if matched, otherwise omit"
    }
  ],
  "keyPoints": ["Key point 1", "Key point 2"]
}

Rules:
- Only include contacts actually mentioned in the content
- Only include dealSignals if there are genuine commercial signals (budget, timeline, deal discussion)
- Match contacts to existing CRM contacts by email (exact) or full name + company
- Match deals to existing CRM deals only if the deal is explicitly referenced
- sentiment must be exactly one of: positive, neutral, negative, urgent
- intent must be exactly one of: sales, support, feedback, general, onboarding`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const textContent = data.content.find((c) => c.type === 'text');
  if (!textContent) {
    throw new Error('Anthropic returned no text content');
  }

  // Strip any accidental markdown code fences
  const raw = textContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(raw) as CaptureExtraction;

  // Entity resolution (server-side, not relying on Claude to do it perfectly)
  parsed.contacts = resolveContacts(parsed.contacts ?? [], contacts);
  parsed.dealSignals = resolveDeals(parsed.dealSignals ?? [], deals, rawContent);

  // Ensure required arrays exist
  parsed.topics = parsed.topics ?? [];
  parsed.actionItems = parsed.actionItems ?? [];
  parsed.keyPoints = parsed.keyPoints ?? [];

  return parsed;
}
