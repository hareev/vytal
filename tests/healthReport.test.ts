import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreHealthPayload, DIMENSION_WEIGHTS } from '../src/lib/scoring/engine'
import { buildHealthReportHtml, buildHealthReportJson } from '../src/lib/report/healthReport'
import type { RawHealthPayload } from '../src/types/health'

function payload(platform: 'dynamics365' | 'salesforce', withProcessFit: boolean): RawHealthPayload {
  const n = null
  return {
    connection: { id: 'o1', platform, orgName: 'Acme', orgUrl: 'https://acme.example', connectedAt: new Date('2026-11-01') },
    schema: { totalEntities: 300, customEntities: 40, unusedEntities: 5, totalFields: 900, unusedFields: n, deprecatedObjects: n, namingViolations: n },
    automation: { totalFlows: 20, activeFlows: 15, inactiveFlows: 5, circularDependencies: n, maxNestingDepth: n, flowsWithoutErrorHandling: n, deprecatedApiCalls: 2 },
    dataQuality: { totalRecordsSampled: n, duplicateCount: n, incompleteRequiredFields: n, staleRecords30d: n, staleRecords90d: n },
    security: { totalUsers: 50, adminUsers: 4, dormantAdmins: 1, usersWithoutMFA: n, rolesWithExcessivePrivilege: 2, auditLogEnabled: true },
    adoption: { monthlyActiveUsers: 30, totalLicensedUsers: 45, featureUtilisationPct: n, automationsPerActiveUser: 0.5, recentCustomisations30d: 6 },
    ...(withProcessFit ? { processFit: { closedDealsAnalysed: 120, wonDealsAnalysed: 40, skippedStageDeals: 14, backwardMoveDeals: 9, createdClosedDeals: 3 } } : {}),
  }
}

test('engine weights shared with the report sum to 1', () => {
  const total = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
  assert.equal(DIMENSION_WEIGHTS.processFit, 0.25)
})

test('report includes process fit for a Salesforce scan', () => {
  const scored = scoreHealthPayload(payload('salesforce', true))
  const html = buildHealthReportHtml(scored, null)
  assert.match(html, /Deals that moved back a stage/)
  assert.match(html, /18\.75%/)
  assert.match(html, /stage history of closed deals/)
  const json = JSON.parse(buildHealthReportJson(scored, null))
  assert.ok(json.dimensions.processFit)
  assert.equal(json.weights.processFit, 0.25)
})

test('a Dynamics scan without process fit still builds, showing it as not measured', () => {
  const scored = scoreHealthPayload(payload('dynamics365', false))
  const html = buildHealthReportHtml(scored, null)
  assert.match(html, /Closed deals analysed/)
  assert.doesNotMatch(html, /stage history of closed deals/)
  const json = JSON.parse(buildHealthReportJson(scored, null))
  assert.equal(json.dimensions.processFit.score, null)
})
