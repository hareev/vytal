import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreHealthPayload } from '../src/lib/scoring/engine'
import type { RawHealthPayload } from '../src/types/health'

function d365Payload(): RawHealthPayload {
  return {
    connection: { id: 'org1', platform: 'dynamics365', orgName: 'Contoso', orgUrl: 'https://contoso.crm.dynamics.com', connectedAt: new Date('2026-11-01') },
    schema: { totalEntities: 400, customEntities: 120, unusedEntities: 30, totalFields: 5000, unusedFields: null, deprecatedObjects: null, namingViolations: null },
    automation: { totalFlows: 80, activeFlows: 50, inactiveFlows: 30, circularDependencies: null, maxNestingDepth: null, flowsWithoutErrorHandling: null, deprecatedApiCalls: null },
    dataQuality: { totalRecordsSampled: null, duplicateCount: null, incompleteRequiredFields: null, staleRecords30d: null, staleRecords90d: null },
    security: { totalUsers: 200, adminUsers: 25, dormantAdmins: null, usersWithoutMFA: null, rolesWithExcessivePrivilege: null, auditLogEnabled: false },
    adoption: { monthlyActiveUsers: null, totalLicensedUsers: 180, featureUtilisationPct: null, automationsPerActiveUser: null, recentCustomisations30d: null },
  }
}

// The weights before process fit was added. D365 scans carry no process fit
// block, so their overall score must still be this weighted average.
const OLD_WEIGHTS = { schema: 0.25, automation: 0.25, dataQuality: 0.2, security: 0.2, adoption: 0.1 } as const

test('a scan without process fit scores the same as before process fit existed', () => {
  const scored = scoreHealthPayload(d365Payload())
  assert.equal(scored.dimensions.processFit.score, null)
  assert.equal(scored.dimensions.processFit.checksMeasured, 0)

  let sum = 0
  let weight = 0
  for (const [k, w] of Object.entries(OLD_WEIGHTS)) {
    const s = scored.dimensions[k as keyof typeof OLD_WEIGHTS].score
    if (s !== null) { sum += s * w; weight += w }
  }
  assert.equal(scored.overallScore, Math.round(sum / weight))
})

test('process fit issues fire on high ratios and are scored', () => {
  const raw = d365Payload()
  raw.connection.platform = 'salesforce'
  raw.processFit = { closedDealsAnalysed: 100, wonDealsAnalysed: 40, skippedStageDeals: 20, backwardMoveDeals: 30, createdClosedDeals: 5 }
  const pf = scoreHealthPayload(raw).dimensions.processFit
  assert.equal(pf.checksMeasured, 3)
  assert.ok(pf.score !== null && pf.score < 100)
  const titles = pf.issues.map(i => i.title)
  assert.ok(titles.some(t => /skipped a usual stage/.test(t)))
  assert.ok(titles.some(t => /moved back a stage/.test(t)))
  assert.ok(!titles.some(t => /entered already closed/.test(t)), '5% created-closed is under the threshold')
})

test('a clean process scores 100 and partial data measures only what it can', () => {
  const raw = d365Payload()
  raw.processFit = { closedDealsAnalysed: 100, wonDealsAnalysed: null, skippedStageDeals: null, backwardMoveDeals: 0, createdClosedDeals: 0 }
  const pf = scoreHealthPayload(raw).dimensions.processFit
  assert.equal(pf.score, 100)
  assert.equal(pf.checksMeasured, 2)
  assert.equal(pf.notMeasured.length, 1)
})

test('Salesforce wording replaces Dynamics wording in issues', () => {
  const raw = d365Payload()
  raw.connection.platform = 'salesforce'
  raw.automation.deprecatedApiCalls = 3
  const scored = scoreHealthPayload(raw)
  const text = JSON.stringify(scored.dimensions)
  assert.match(text, /Process Builder/)
})
