import type { AccountProfile, AccountIntelligence } from '@/types/customers'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export async function generateAccountIntelligence(profile: AccountProfile): Promise<AccountIntelligence> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const prompt = buildPrompt(profile)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: `You are a senior business intelligence analyst specializing in account intelligence and customer profiling.
You receive aggregated CRM data about a company and produce structured intelligence about them.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.
Be specific and actionable. Ground every inference in the data provided.`,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json() as { content?: Array<{ text?: string }> }
  const raw = data.content?.[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(raw) as {
      companyProfile: string
      industry?: string
      estimatedSize?: string
      productInterests: string[]
      toolsDetected: string[]
      keyContacts: { name: string; role: string }[]
      churnRisk: 'low' | 'medium' | 'high'
      expansionSignal: number
      recommendedActions: string[]
      intelligenceSummary: string
    }

    return {
      companyProfile: parsed.companyProfile,
      industry: parsed.industry,
      estimatedSize: parsed.estimatedSize,
      productInterests: parsed.productInterests ?? [],
      toolsDetected: parsed.toolsDetected ?? [],
      keyContacts: parsed.keyContacts ?? [],
      churnRisk: parsed.churnRisk ?? 'medium',
      expansionSignal: typeof parsed.expansionSignal === 'number' ? parsed.expansionSignal : 0.5,
      recommendedActions: parsed.recommendedActions ?? [],
      intelligenceSummary: parsed.intelligenceSummary,
      generatedAt: new Date(),
    }
  } catch {
    throw new Error('Claude returned invalid JSON. Check your API key and try again.')
  }
}

function buildPrompt(profile: AccountProfile): string {
  const contactLines = profile.contacts
    .map((c) => `  - ${c.name} (${c.email}) | status: ${c.status}${c.title ? ` | title: ${c.title}` : ''}${c.tags.length ? ` | tags: ${c.tags.join(', ')}` : ''}`)
    .join('\n')

  const dealLines = profile.deals.length
    ? profile.deals.map((d) => `  - "${d.title}" | $${d.value.toLocaleString()} | stage: ${d.stage} | status: ${d.status}`).join('\n')
    : '  - No deals on record'

  const signalLines = profile.signals.length
    ? profile.signals.map((s) => `  - [${s.source}] ${s.type}: ${s.summary} (${s.capturedAt})`).join('\n')
    : '  - No signals captured'

  return `
Account Intelligence Request

Company: ${profile.companyName}

Contacts (${profile.contacts.length}):
${contactLines}

Deals (${profile.deals.length}):
${dealLines}

Recent Signals (${profile.signals.length}):
${signalLines}

Based on the above internal CRM data, produce structured account intelligence.

Return a JSON object with this exact shape:
{
  "companyProfile": "<2-3 sentence company overview based on available data>",
  "industry": "<inferred industry or null>",
  "estimatedSize": "<size estimate like '50-200 employees' based on signals, or null>",
  "productInterests": ["<product/feature areas they appear interested in, 2-5 items>"],
  "toolsDetected": ["<tools or platforms mentioned in signals/emails, 0-5 items>"],
  "keyContacts": [
    { "name": "<contact name>", "role": "<inferred role like Decision Maker, Technical Lead, etc>" }
  ],
  "churnRisk": "low|medium|high",
  "expansionSignal": <0.0 to 1.0 propensity score>,
  "recommendedActions": ["<2-4 specific, actionable next steps>"],
  "intelligenceSummary": "<1 paragraph synthesis of the account situation, risk, and opportunity>"
}

If you cannot confidently infer a field, use null for optional fields or empty arrays for list fields.
Base churnRisk and expansionSignal on contact statuses, deal stages, and signal patterns.
`
}
