import type { AIDiagnosis, Issue, IssueSeverity, RawHealthPayload, ScoredHealthPayload } from '@/types/health'

// ─── Client health report ─────────────────────────────────────────────────────
//
// Turns a scored scan (and the AI diagnosis, if there is one) into a report a
// consultant can hand to a client:
//   - a self-contained HTML document (no external assets; print it to PDF from
//     the browser), and
//   - a JSON evidence file with the exact measured values behind every score.
//
// Every statement in the report comes from the scan. Checks that were not
// measured are listed as such, never shown as healthy.

type DimensionKey = keyof ScoredHealthPayload['dimensions']

const DIMENSION_ORDER: DimensionKey[] = ['schema', 'automation', 'dataQuality', 'security', 'adoption']

const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  schema: 0.25,
  automation: 0.25,
  dataQuality: 0.20,
  security: 0.20,
  adoption: 0.10,
}

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

const PLATFORM_NAMES: Record<string, string> = {
  dynamics365: 'Dynamics 365',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  zoho: 'Zoho CRM',
  sugarcrm: 'SugarCRM',
  pega: 'Pega',
  freshsales: 'Freshsales',
  pipedrive: 'Pipedrive',
  custom: 'Custom CRM',
}

const METRIC_LABELS: { [D in keyof Omit<RawHealthPayload, 'connection'>]: Record<keyof RawHealthPayload[D], string> } = {
  schema: {
    totalEntities: 'Total entities / objects',
    customEntities: 'Custom entities / objects',
    unusedEntities: 'Unused custom entities',
    totalFields: 'Custom fields',
    unusedFields: 'Unused fields',
    deprecatedObjects: 'Deprecated objects in use',
    namingViolations: 'Naming convention violations',
  },
  automation: {
    totalFlows: 'Flows',
    activeFlows: 'Active flows',
    inactiveFlows: 'Inactive flows',
    circularDependencies: 'Circular dependencies',
    maxNestingDepth: 'Maximum nesting depth',
    flowsWithoutErrorHandling: 'Flows without error handling',
    deprecatedApiCalls: 'Deprecated API calls',
  },
  dataQuality: {
    totalRecordsSampled: 'Records sampled',
    duplicateCount: 'Duplicate records',
    incompleteRequiredFields: 'Records with incomplete required fields (%)',
    staleRecords30d: 'Records not updated in 30 days',
    staleRecords90d: 'Records not updated in 90 days',
  },
  security: {
    totalUsers: 'Users',
    adminUsers: 'System administrators',
    dormantAdmins: 'Dormant administrators (90+ days)',
    usersWithoutMFA: 'Users without MFA',
    rolesWithExcessivePrivilege: 'Over-privileged roles',
    auditLogEnabled: 'Audit logging',
  },
  adoption: {
    monthlyActiveUsers: 'Monthly active users',
    totalLicensedUsers: 'Licensed users',
    featureUtilisationPct: 'Feature utilisation (%)',
    automationsPerActiveUser: 'Automations per active user',
    recentCustomisations30d: 'Customisations in the last 30 days',
  },
}

export interface HealthReportOptions {
  /** Who prepared the report, e.g. a consultant or firm name. Optional. */
  preparedBy?: string
  /** When the report is generated. Defaults to now. */
  generatedAt?: Date
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? platform
}

export function reportFileName(scored: ScoredHealthPayload, ext: 'html' | 'json'): string {
  const org = (scored.connection.orgName || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org'
  const date = new Date(scored.scannedAt).toISOString().slice(0, 10)
  return `vytal-health-report-${org}-${date}.${ext}`
}

/** Machine-readable evidence: the measured values, scores, issues and coverage. */
export function buildHealthReportJson(
  scored: ScoredHealthPayload,
  diagnosis: AIDiagnosis | null,
  options: HealthReportOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date()
  const report = {
    reportVersion: 1,
    generatedAt: generatedAt.toISOString(),
    preparedBy: options.preparedBy || null,
    org: {
      name: scored.connection.orgName,
      url: scored.connection.orgUrl,
      platform: scored.connection.platform,
    },
    scannedAt: new Date(scored.scannedAt).toISOString(),
    overallScore: scored.overallScore,
    checksMeasured: scored.checksMeasured,
    checksTotal: scored.checksTotal,
    weights: DIMENSION_WEIGHTS,
    dimensions: Object.fromEntries(DIMENSION_ORDER.map(key => {
      const d = scored.dimensions[key]
      return [key, {
        label: d.label,
        score: d.score,
        checksMeasured: d.checksMeasured,
        checksTotal: d.checksTotal,
        notMeasured: d.notMeasured,
        issues: d.issues.map(stripIssueId),
      }]
    })),
    measuredValues: stripConnection(scored.raw),
    aiDiagnosis: diagnosis ? {
      summary: diagnosis.summary,
      riskLevel: diagnosis.riskLevel,
      recommendations: diagnosis.recommendations,
      generatedAt: new Date(diagnosis.generatedAt).toISOString(),
    } : null,
  }
  return JSON.stringify(report, null, 2)
}

/** A self-contained, print-ready HTML report. */
export function buildHealthReportHtml(
  scored: ScoredHealthPayload,
  diagnosis: AIDiagnosis | null,
  options: HealthReportOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date()
  const conn = scored.connection
  const platform = platformName(conn.platform)
  const issues = sortIssues(DIMENSION_ORDER.flatMap(k => scored.dimensions[k].issues))
  const counts = countBySeverity(issues)
  const notMeasuredTotal = scored.checksTotal - scored.checksMeasured
  const title = `CRM health report: ${conn.orgName || platform}`

  const body = [
    section('cover', `
      <div class="eyebrow">CRM health report</div>
      <h1>${esc(conn.orgName || 'Unnamed org')}</h1>
      <dl class="meta">
        ${metaRow('Platform', platform)}
        ${conn.orgUrl ? metaRow('Environment', conn.orgUrl) : ''}
        ${metaRow('Scanned', fmtDateTime(scored.scannedAt))}
        ${metaRow('Report generated', fmtDateTime(generatedAt))}
        ${options.preparedBy ? metaRow('Prepared by', options.preparedBy) : ''}
      </dl>`),

    section('summary', `
      <h2>Summary</h2>
      <div class="score-row">
        <div class="score ${scoreClass(scored.overallScore)}">
          <span class="num">${scored.overallScore ?? '—'}</span>
          <span class="den">${scored.overallScore === null ? 'not measured' : '/ 100'}</span>
        </div>
        <div>
          <p class="lead">${esc(overallSentence(scored, counts))}</p>
          <p class="coverage">Vytal measured <strong>${scored.checksMeasured} of ${scored.checksTotal}</strong> health checks in this scan.${
            notMeasuredTotal > 0
              ? ` The other ${notMeasuredTotal} were not measured in this scan; they are listed below and are <strong>not counted as healthy</strong>.`
              : ''}</p>
        </div>
      </div>
      ${diagnosis ? `
        <div class="callout">
          <div class="callout-label">AI assessment · risk level: ${esc(diagnosis.riskLevel)}</div>
          <p>${esc(diagnosis.summary)}</p>
        </div>` : ''}`),

    section('dimensions', `
      <h2>Scores by area</h2>
      <table>
        <thead><tr><th>Area</th><th class="num">Score</th><th class="num">Weight</th><th class="num">Checks measured</th><th>Not measured</th></tr></thead>
        <tbody>
          ${DIMENSION_ORDER.map(key => {
            const d = scored.dimensions[key]
            return `<tr>
              <td>${esc(d.label)}</td>
              <td class="num"><span class="pill ${scoreClass(d.score)}">${d.score ?? 'Not measured'}</span></td>
              <td class="num">${Math.round(DIMENSION_WEIGHTS[key] * 100)}%</td>
              <td class="num">${d.checksMeasured} of ${d.checksTotal}</td>
              <td class="muted">${d.notMeasured.length ? esc(d.notMeasured.join(', ')) : '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`),

    section('findings', `
      <h2>Findings</h2>
      ${issues.length === 0
        ? `<p class="muted">No issues were found among the checks that were measured.${notMeasuredTotal > 0 ? ' That says nothing about the checks that were not measured.' : ''}</p>`
        : `<p class="muted">${issues.length} finding${issues.length === 1 ? '' : 's'}, most severe first.</p>
           <ol class="findings">${issues.map(findingHtml).join('')}</ol>`}`),

    diagnosis && diagnosis.recommendations.length ? section('recommendations', `
      <h2>Recommended next steps</h2>
      <p class="muted">Drafted by AI from the scores and findings above, quick wins first. Review before acting.</p>
      <ol class="recs">
        ${[...diagnosis.recommendations].sort((a, b) => a.rank - b.rank).map(r => `
          <li>
            <div class="rec-title">${esc(r.title)}</div>
            <div class="rec-meta">${esc(scored.dimensions[r.dimension]?.label ?? r.dimension)} · impact ${esc(r.impact)} · effort ${esc(r.effort)}</div>
            <p>${esc(r.rationale)}</p>
          </li>`).join('')}
      </ol>`) : '',

    section('method', `
      <h2>How this scan works</h2>
      <ul class="method">
        <li>Vytal read metadata and counts from the org through ${esc(platform)}'s API, using read-only queries. It did not change anything in the org.</li>
        <li>Each area starts at 100 and loses points for each issue found. A check runs only when every value it needs was measured; a check that could not be measured is skipped and listed, not scored as healthy.</li>
        <li>The overall score is the weighted average of the areas that were measured (weights shown above), re-weighted across those areas. An area with no measured checks has no score.</li>
        ${diagnosis ? '<li>The AI assessment was generated from the scores, check coverage and findings only. No records from the org were sent to the AI model.</li>' : ''}
        <li>This report is a point-in-time snapshot from ${esc(fmtDateTime(scored.scannedAt))}.</li>
      </ul>`),

    section('appendix', `
      <h2>Appendix: measured values</h2>
      <p class="muted">The values behind every score. "Not measured" means this scan did not measure it.</p>
      ${(Object.keys(METRIC_LABELS) as Array<keyof typeof METRIC_LABELS>).map(dim => `
        <h3>${esc(scored.dimensions[dim].label)}</h3>
        <table class="values"><tbody>
          ${Object.entries(METRIC_LABELS[dim]).map(([field, label]) => {
            const value = (scored.raw[dim] as Record<string, number | boolean | null>)[field]
            return `<tr><td>${esc(label)}</td><td class="num ${value === null || value === undefined ? 'muted' : ''}">${esc(fmtValue(value))}</td></tr>`
          }).join('')}
        </tbody></table>`).join('')}`),
  ].join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
${body}
<footer>Generated by Vytal, open-source CRM health intelligence. Print this page or save it as PDF to share.</footer>
</main>
</body>
</html>
`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(id: string, inner: string): string {
  return `<section id="${id}">${inner}</section>`
}

function metaRow(label: string, value: string): string {
  return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
}

function findingHtml(i: Issue): string {
  return `<li class="finding">
    <div class="finding-head"><span class="sev sev-${i.severity}">${esc(i.severity)}</span><span class="finding-title">${esc(i.title)}</span></div>
    <p>${esc(i.description)}</p>
    ${i.affectedCount !== undefined ? `<p class="muted">Affected: ${i.affectedCount}</p>` : ''}
    ${i.remediationHint ? `<p class="fix"><strong>Suggested fix:</strong> ${esc(i.remediationHint)}</p>` : ''}
  </li>`
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
}

function countBySeverity(issues: Issue[]): Record<IssueSeverity, number> {
  const counts: Record<IssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const i of issues) counts[i.severity]++
  return counts
}

function overallSentence(scored: ScoredHealthPayload, counts: Record<IssueSeverity, number>): string {
  if (scored.overallScore === null) {
    return 'No health checks could be measured in this scan, so there is no overall score.'
  }
  const urgent = counts.critical + counts.high
  const band = scored.overallScore >= 80 ? 'healthy' : scored.overallScore >= 65 ? 'worth watching' : scored.overallScore >= 50 ? 'in need of attention' : 'at critical risk'
  const issuesPart = urgent === 0
    ? 'with no critical or high-severity findings among the measured checks'
    : `with ${counts.critical} critical and ${counts.high} high-severity finding${urgent === 1 ? '' : 's'}`
  if (scored.checksMeasured < scored.checksTotal / 2) {
    return `On the ${scored.checksMeasured} of ${scored.checksTotal} checks Vytal could measure, this org scores ${scored.overallScore} out of 100, ${issuesPart}. Most checks were not measured, so treat this score as partial rather than a verdict on the org's health.`
  }
  return `On the checks Vytal could measure, this org scores ${scored.overallScore} out of 100 and looks ${band}, ${issuesPart}.`
}

function scoreClass(score: number | null): string {
  if (score === null) return 'none'
  if (score >= 80) return 'good'
  if (score >= 60) return 'warn'
  return 'bad'
}

function fmtValue(value: number | boolean | null | undefined): string {
  if (value === null || value === undefined) return 'Not measured'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  return value.toLocaleString('en-US')
}

function fmtDateTime(d: Date | string): string {
  const date = new Date(d)
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

function stripIssueId({ id: _id, ...rest }: Issue): Omit<Issue, 'id'> {
  return rest
}

function stripConnection({ connection: _c, ...rest }: RawHealthPayload): Omit<RawHealthPayload, 'connection'> {
  return rest
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const REPORT_CSS = `
:root { --text:#1a1d24; --muted:#5f6673; --line:#e3e6eb; --soft:#f5f6f8; --good:#1f7a4d; --warn:#9a6200; --bad:#b42318; --accent:#3b5bdb; }
* { box-sizing: border-box; }
body { margin:0; background:#fff; color:var(--text); font:14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
main { max-width: 820px; margin: 0 auto; padding: 40px 24px 56px; }
section { margin-bottom: 36px; }
h1 { font-size: 28px; margin: 4px 0 16px; letter-spacing: -0.02em; }
h2 { font-size: 18px; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
h3 { font-size: 14px; margin: 18px 0 6px; }
p { margin: 0 0 8px; }
.eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 600; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 24px; margin: 0; }
.meta dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.meta dd { margin: 0; overflow-wrap: anywhere; }
.score-row { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.score { width: 120px; height: 120px; border-radius: 50%; border: 8px solid var(--line); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
.score .num { font-size: 34px; font-weight: 700; line-height: 1; }
.score .den { font-size: 12px; color: var(--muted); }
.score.good { border-color: var(--good); } .score.warn { border-color: var(--warn); } .score.bad { border-color: var(--bad); }
.score-row > div:last-child { flex: 1; min-width: 240px; }
.lead { font-size: 16px; }
.coverage { color: var(--muted); }
.callout { margin-top: 16px; background: var(--soft); border-left: 3px solid var(--accent); padding: 12px 16px; border-radius: 4px; }
.callout-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
td.num, th.num { text-align: right; white-space: nowrap; }
table.values td:first-child { width: 70%; }
.muted { color: var(--muted); }
.pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-weight: 600; font-size: 12px; background: var(--soft); }
.pill.good { color: var(--good); } .pill.warn { color: var(--warn); } .pill.bad { color: var(--bad); } .pill.none { color: var(--muted); font-weight: 400; }
ol.findings, ol.recs { padding-left: 20px; margin: 0; }
.finding, .recs li { margin-bottom: 14px; break-inside: avoid; }
.finding-head { display: flex; gap: 8px; align-items: baseline; }
.finding-title, .rec-title { font-weight: 600; }
.rec-meta { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.sev { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 6px; border-radius: 4px; font-weight: 700; background: var(--soft); color: var(--muted); }
.sev-critical { background: #fde8e7; color: var(--bad); } .sev-high { background: #fff1e0; color: var(--warn); }
.fix { background: var(--soft); padding: 6px 10px; border-radius: 4px; }
ul.method { padding-left: 20px; margin: 0; } ul.method li { margin-bottom: 6px; }
footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
@media print {
  main { padding: 0; max-width: none; }
  section { break-inside: auto; }
  h2, h3 { break-after: avoid; }
  footer { position: static; }
  @page { margin: 18mm 16mm; }
}
`
