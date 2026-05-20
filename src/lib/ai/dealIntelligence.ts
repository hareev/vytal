import type { Deal, Contact, Activity } from '@/types/crm'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export interface DealIntelligence {
  closeProbability: number        // 0-100
  riskLevel: 'low' | 'medium' | 'high'
  signals: string[]               // 3-5 bullet observations
  recommendation: string          // 1-2 sentences next action
  generatedAt: Date
}

export async function analyzeDeal(
  deal: Deal,
  contact: Contact | null,
  recentActivities: Activity[]
): Promise<DealIntelligence> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const prompt = buildDealPrompt(deal, contact, recentActivities)

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
      system: `You are a senior sales analyst and CRM expert.
You receive deal data and must return a structured JSON deal intelligence report.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.`,
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
      closeProbability: number
      riskLevel: DealIntelligence['riskLevel']
      signals: string[]
      recommendation: string
    }

    return {
      closeProbability: Math.min(100, Math.max(0, Math.round(parsed.closeProbability))),
      riskLevel: parsed.riskLevel,
      signals: parsed.signals,
      recommendation: parsed.recommendation,
      generatedAt: new Date(),
    }
  } catch {
    throw new Error('Claude returned invalid JSON. Check your API key and try again.')
  }
}

function buildDealPrompt(deal: Deal, contact: Contact | null, activities: Activity[]): string {
  const now = new Date()
  const lastActivity = activities.length > 0
    ? activities.reduce((latest, a) => new Date(a.createdAt) > new Date(latest.createdAt) ? a : latest)
    : null
  const daysSinceLastActivity = lastActivity
    ? Math.floor((now.getTime() - new Date(lastActivity.createdAt).getTime()) / 86400000)
    : null
  const daysToClose = deal.closeDate
    ? Math.floor((new Date(deal.closeDate).getTime() - now.getTime()) / 86400000)
    : null

  const activitySummary = activities
    .slice(0, 10)
    .map(a => `- ${a.type}: "${a.subject}"${a.completedAt ? ' (completed)' : ' (pending)'}`)
    .join('\n')

  return `
Deal Analysis Request

Deal title: ${deal.title}
Deal value: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency }).format(deal.value)}
Current stage: ${deal.stageId}
Deal status: ${deal.status}
${daysToClose !== null ? `Days until close date: ${daysToClose} days${daysToClose < 0 ? ' (OVERDUE)' : ''}` : 'No close date set'}
${daysSinceLastActivity !== null ? `Days since last activity: ${daysSinceLastActivity}` : 'No activity recorded'}
${deal.notes ? `Deal notes: ${deal.notes}` : ''}

Contact: ${contact ? `${contact.firstName} ${contact.lastName} at ${contact.company ?? 'unknown company'} (${contact.status})` : 'No contact linked'}

Recent activities (${activities.length} total):
${activitySummary || 'None'}

Return a JSON object with this exact shape:
{
  "closeProbability": <integer 0-100>,
  "riskLevel": "<low | medium | high>",
  "signals": ["<observation 1>", "<observation 2>", "<observation 3>"],
  "recommendation": "<1-2 sentence next best action for the sales rep>"
}

Provide 3-5 signals. Base closeProbability on stage progression, activity recency, close date proximity, and deal value. Higher values and longer inactivity increase risk.
`
}
