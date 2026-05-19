import type { Contact } from '@/types/crm'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export interface ContactEnrichment {
  industry?: string
  companySize?: string      // e.g. '50-200 employees'
  jobTitle?: string
  linkedinSuggestion?: string
  notes: string             // AI's confidence note
  generatedAt: Date
}

export async function enrichContact(contact: Contact): Promise<ContactEnrichment> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const prompt = buildEnrichmentPrompt(contact)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: `You are a business intelligence analyst specializing in contact enrichment.
You infer professional details from available signals like email domains and company names.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.
Be honest about your confidence level in the notes field.`,
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
      industry?: string
      companySize?: string
      jobTitle?: string
      linkedinSuggestion?: string
      notes: string
    }

    return {
      industry: parsed.industry ?? undefined,
      companySize: parsed.companySize ?? undefined,
      jobTitle: parsed.jobTitle ?? undefined,
      linkedinSuggestion: parsed.linkedinSuggestion ?? undefined,
      notes: parsed.notes,
      generatedAt: new Date(),
    }
  } catch {
    throw new Error('Claude returned invalid JSON. Check your API key and try again.')
  }
}

function buildEnrichmentPrompt(contact: Contact): string {
  const emailDomain = contact.email.split('@')[1] ?? ''

  return `
Contact Enrichment Request

Name: ${contact.firstName} ${contact.lastName}
Email: ${contact.email}
Email domain: ${emailDomain}
${contact.company ? `Company: ${contact.company}` : 'Company: Unknown'}
${contact.phone ? `Phone: ${contact.phone}` : ''}
Current CRM status: ${contact.status}
${contact.notes ? `Existing notes: ${contact.notes}` : ''}

Based on the email domain "${emailDomain}" and company name "${contact.company ?? 'not provided'}", infer professional details.

Return a JSON object with this exact shape:
{
  "industry": "<inferred industry or null>",
  "companySize": "<size estimate like '10-50 employees', '200-1000 employees', etc, or null>",
  "jobTitle": "<likely job title based on context or null>",
  "linkedinSuggestion": "<suggested LinkedIn search URL like https://linkedin.com/in/firstname-lastname or null>",
  "notes": "<1-2 sentences explaining confidence level and what signals were used to make these inferences>"
}

If you cannot confidently infer a field, use null for that field. Always include a notes field explaining your reasoning and confidence.
`
}
