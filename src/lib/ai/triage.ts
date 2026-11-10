import type { ScoredHealthPayload, AIDiagnosis } from '@/types/health'

// The AI diagnosis runs on the API server (POST /api/health/diagnosis) so the
// Anthropic key is never shipped in the browser bundle. Set ANTHROPIC_API_KEY
// (and optionally ANTHROPIC_MODEL) on the server.

const API_BASE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  'http://localhost:3001/api'

/**
 * Send the scored health report to the server and get back a structured
 * diagnosis: risk level, summary, and ranked recommendations.
 *
 * Only scores, check coverage and issue titles/descriptions are sent — not the
 * raw org data.
 */
export async function generateDiagnosis(scored: ScoredHealthPayload): Promise<AIDiagnosis> {
  const token = localStorage.getItem('vytal_token')

  const res = await fetch(`${API_BASE}/health/diagnosis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(toRequest(scored)),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(body.error ?? `AI diagnosis failed (${res.status})`)
  }

  const data = await res.json() as Omit<AIDiagnosis, 'generatedAt'> & { generatedAt: string }
  return { ...data, generatedAt: new Date(data.generatedAt) }
}

function toRequest(scored: ScoredHealthPayload) {
  const dims = scored.dimensions
  const dim = (d: ScoredHealthPayload['dimensions'][keyof ScoredHealthPayload['dimensions']]) => ({
    label: d.label,
    score: d.score,
    checksMeasured: d.checksMeasured,
    checksTotal: d.checksTotal,
    notMeasured: d.notMeasured,
    issues: d.issues.map(i => ({ severity: i.severity, title: i.title, description: i.description })),
  })

  return {
    platform: scored.connection.platform,
    orgName: scored.connection.orgName,
    overallScore: scored.overallScore,
    checksMeasured: scored.checksMeasured,
    checksTotal: scored.checksTotal,
    dimensions: {
      schema: dim(dims.schema),
      automation: dim(dims.automation),
      dataQuality: dim(dims.dataQuality),
      security: dim(dims.security),
      adoption: dim(dims.adoption),
    },
  }
}
