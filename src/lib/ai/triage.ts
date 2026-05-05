import type { ScoredHealthPayload, AIDiagnosis, AIRecommendation } from '@/types/health'

const MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Call the Claude API with the scored health payload and get back a structured
 * diagnosis: risk level, summary, and ranked recommendations.
 */
export async function generateDiagnosis(
  scored: ScoredHealthPayload
): Promise<AIDiagnosis> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const allIssues = Object.values(scored.dimensions).flatMap(d => d.issues)

  const prompt = buildPrompt(scored, allIssues.length)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: `You are a senior CRM architect and platform health expert.
You receive a scored health report for a CRM org and must return a structured JSON diagnosis.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.
Your recommendations must be specific, actionable, and ordered by impact.`,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text ?? '{}'

  try {
    const parsed = JSON.parse(raw) as {
      summary: string
      riskLevel: AIDiagnosis['riskLevel']
      recommendations: Array<{
        title: string
        rationale: string
        effort: AIRecommendation['effort']
        impact: AIRecommendation['impact']
        dimension: AIRecommendation['dimension']
      }>
    }

    return {
      summary: parsed.summary,
      riskLevel: parsed.riskLevel,
      recommendations: parsed.recommendations.map((r, i) => ({ ...r, rank: i + 1 })),
      generatedAt: new Date(),
    }
  } catch {
    throw new Error('Claude returned invalid JSON. Check your API key and try again.')
  }
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function buildPrompt(scored: ScoredHealthPayload, totalIssues: number): string {
  const dims = scored.dimensions
  const topIssues = Object.values(dims)
    .flatMap(d => d.issues)
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 8)
    .map(i => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`)
    .join('\n')

  return `
CRM Health Report
Platform: ${scored.connection.platform}
Org: ${scored.connection.orgName} (${scored.connection.orgUrl})
Overall health score: ${scored.overallScore}/100
Total issues found: ${totalIssues}

Dimension scores:
- Schema hygiene: ${dims.schema.score}/100
- Automation complexity: ${dims.automation.score}/100
- Data quality: ${dims.dataQuality.score}/100
- Security posture: ${dims.security.score}/100
- Adoption health: ${dims.adoption.score}/100

Top critical and high issues:
${topIssues || 'None identified.'}

Return a JSON object with this exact shape:
{
  "summary": "<2-3 sentence plain-english summary of the org's health state and the most urgent risk>",
  "riskLevel": "<one of: healthy | watch | attention | critical>",
  "recommendations": [
    {
      "title": "<short actionable title>",
      "rationale": "<1-2 sentences explaining why this matters and the expected impact>",
      "effort": "<low | medium | high>",
      "impact": "<low | medium | high>",
      "dimension": "<schema | automation | dataQuality | security | adoption>"
    }
  ]
}

Return 3-5 recommendations, ordered by (impact DESC, effort ASC) — quick wins first.
`
}
