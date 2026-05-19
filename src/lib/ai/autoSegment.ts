import type { SegmentFilter } from '@/types/marketing'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export interface AutoSegmentResult {
  name: string
  filters: SegmentFilter[]
  reasoning: string
}

export async function generateSegmentFromPrompt(prompt: string): Promise<AutoSegmentResult> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const systemPrompt = buildAutoSegmentSystemPrompt()
  const userMessage = buildAutoSegmentUserPrompt(prompt)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
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
      name: string
      filters: Array<{
        field: string
        operator: SegmentFilter['operator']
        value: string | number
      }>
      reasoning: string
    }

    const validOperators: SegmentFilter['operator'][] = ['is', 'is_not', 'contains', 'gt', 'lt']

    return {
      name: parsed.name,
      filters: parsed.filters.map(f => ({
        field: f.field,
        operator: validOperators.includes(f.operator) ? f.operator : 'is',
        value: f.value,
      })),
      reasoning: parsed.reasoning,
    }
  } catch {
    throw new Error('Claude returned invalid JSON. Check your API key and try again.')
  }
}

function buildAutoSegmentSystemPrompt(): string {
  return `You are a CRM segmentation expert that translates natural language descriptions into structured segment filter rules.

The available SegmentFilter type is:
{
  field: string,        // e.g. "Status", "Company", "Tags", "Created date", "Country", "Industry"
  operator: "is" | "is_not" | "contains" | "gt" | "lt",
  value: string | number
}

Rules:
- Use "gt" and "lt" with numeric values or ISO date strings for date/number comparisons
- Use "is" and "is_not" for exact matches
- Use "contains" for partial text matches
- Map concepts like "enterprise" to company size filters, "Europe" to country/region filters, "inactive" to last activity date filters
- Return ONLY valid JSON — no markdown, no explanation, no backticks.`
}

function buildAutoSegmentUserPrompt(naturalLanguagePrompt: string): string {
  return `
Translate this natural language segment description into structured filters:

"${naturalLanguagePrompt}"

Return a JSON object with this exact shape:
{
  "name": "<a short, descriptive segment name>",
  "filters": [
    {
      "field": "<field name>",
      "operator": "<is | is_not | contains | gt | lt>",
      "value": "<string or number>"
    }
  ],
  "reasoning": "<1-2 sentences explaining the filter choices made>"
}

Provide 1-5 filters that best represent the described audience.
`
}
