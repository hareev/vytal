// ---------------------------------------------------------------------------
// healthDiagnosis.ts — AI triage of a scored CRM health report
//
// Runs on the server so the Anthropic key never ships in the browser bundle.
// Uses ANTHROPIC_API_KEY and optional ANTHROPIC_MODEL, like crmAnalyzer.ts.
// ---------------------------------------------------------------------------

import { z } from 'zod';

const dimensionKey = z.enum(['schema', 'automation', 'dataQuality', 'security', 'adoption']);

const issueSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().max(300),
  description: z.string().max(1000),
});

const dimensionSchema = z.object({
  label: z.string().max(100),
  score: z.number().min(0).max(100).nullable(),
  checksMeasured: z.number().int().min(0),
  checksTotal: z.number().int().min(0),
  notMeasured: z.array(z.string().max(100)).max(50),
  issues: z.array(issueSchema).max(100),
});

export const healthDiagnosisRequestSchema = z.object({
  platform: z.string().max(50),
  orgName: z.string().max(200),
  overallScore: z.number().min(0).max(100).nullable(),
  checksMeasured: z.number().int().min(0),
  checksTotal: z.number().int().min(0),
  dimensions: z.object({
    schema: dimensionSchema,
    automation: dimensionSchema,
    dataQuality: dimensionSchema,
    security: dimensionSchema,
    adoption: dimensionSchema,
  }),
});

export type HealthDiagnosisRequest = z.infer<typeof healthDiagnosisRequestSchema>;

const diagnosisResponseSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(['healthy', 'watch', 'attention', 'critical']),
  recommendations: z.array(z.object({
    title: z.string(),
    rationale: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    dimension: dimensionKey,
  })).min(1).max(8),
});

export interface HealthDiagnosis {
  summary: string;
  riskLevel: 'healthy' | 'watch' | 'attention' | 'critical';
  recommendations: Array<z.infer<typeof diagnosisResponseSchema>['recommendations'][number] & { rank: number }>;
  generatedAt: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

const SYSTEM_PROMPT = `You are a senior CRM architect and platform health expert.
You receive a scored health report for a CRM org and must return a structured JSON diagnosis.
Some checks could not be measured. A check that was not measured is unknown, not healthy: never describe an unmeasured area as healthy or low risk, and say plainly when the score rests on few measured checks.
Respond ONLY with valid JSON — no markdown, no explanation, no backticks.
Your recommendations must be specific, actionable, and ordered by impact.`;

export async function generateHealthDiagnosis(report: HealthDiagnosisRequest): Promise<HealthDiagnosis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(report) }],
    }),
  });

  if (!response.ok) {
    // Log the provider's error server-side; don't echo it to the browser.
    console.error('Anthropic API error', response.status, await response.text().catch(() => ''));
    throw new Error(`AI diagnosis failed (${response.status})`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const textContent = data.content.find((c) => c.type === 'text');
  if (!textContent) throw new Error('AI diagnosis returned no text');

  const raw = textContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  let parsed: z.infer<typeof diagnosisResponseSchema>;
  try {
    parsed = diagnosisResponseSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error('AI diagnosis returned an unexpected format');
  }

  return {
    summary: parsed.summary,
    riskLevel: parsed.riskLevel,
    recommendations: parsed.recommendations.map((r, i) => ({ ...r, rank: i + 1 })),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function fmtScore(score: number | null): string {
  return score === null ? 'not measured' : `${score}/100`;
}

function buildPrompt(r: HealthDiagnosisRequest): string {
  const dims = Object.values(r.dimensions);
  const allIssues = dims.flatMap((d) => d.issues);

  const topIssues = allIssues
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 8)
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`)
    .join('\n');

  const dimensionLines = dims
    .map((d) => `- ${d.label}: ${fmtScore(d.score)} (${d.checksMeasured} of ${d.checksTotal} checks measured)`)
    .join('\n');

  const notMeasured = dims
    .filter((d) => d.notMeasured.length > 0)
    .map((d) => `- ${d.label}: ${d.notMeasured.join(', ')}`)
    .join('\n');

  return `
CRM Health Report
Platform: ${r.platform}
Org: ${r.orgName}
Overall health score: ${fmtScore(r.overallScore)} (weighted over measured dimensions only)
Checks measured: ${r.checksMeasured} of ${r.checksTotal}
Total issues found: ${allIssues.length}

Dimension scores:
${dimensionLines}

Checks that could not be measured (unknown, NOT healthy):
${notMeasured || 'None.'}

Top critical and high issues:
${topIssues || 'None identified among the measured checks.'}

Return a JSON object with this exact shape:
{
  "summary": "<2-3 sentence plain-english summary of the org's health state and the most urgent risk; mention coverage if many checks were not measured>",
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
Do not return "healthy" as the risk level when most checks were not measured.
`;
}
