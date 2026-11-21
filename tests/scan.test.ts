import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SalesforceClient, type FetchLike } from '../core/salesforce/client'
import { scanSalesforceOrg } from '../core/salesforce/scan'
import { scoreHealthPayload } from '../src/lib/scoring/engine'
import { buildEvidenceFile, formatSummary, parseArgs } from '../cli/vytal'

const NOW = new Date('2026-11-19T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()
const INSTANCE = 'https://example.my.salesforce.com'
const TOKEN = 'test-token-not-real'

type Handler = (soql: string, tooling: boolean) => unknown

/** A fake org: each SOQL query is matched by a substring. */
function fakeOrg(routes: Array<[string, Handler | unknown]>, extra: Record<string, unknown> = {}) {
  const calls: string[] = []
  const fetch: FetchLike = async (url, init) => {
    assert.equal(init.method, 'GET', 'scan must only send GET')
    assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`)
    calls.push(url)
    const u = new URL(url)
    const path = u.pathname
    const respond = (status: number, body: unknown) => ({
      ok: status < 400, status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
    if (path.endsWith('/sobjects')) return respond(200, extra.sobjects ?? { sobjects: [] })
    if (path.endsWith('/limits')) return respond(200, extra.limits ?? {})
    if (path.endsWith('/query')) {
      const soql = u.searchParams.get('q') ?? ''
      const tooling = path.includes('/tooling/')
      for (const [match, h] of routes) {
        if (soql.includes(match)) {
          const body = typeof h === 'function' ? (h as Handler)(soql, tooling) : h
          if (body && typeof body === 'object' && 'error' in (body as object)) {
            const e = body as { error: number; errorCode: string }
            return respond(e.error, [{ message: 'denied', errorCode: e.errorCode }])
          }
          if (typeof body === 'number') return respond(200, { totalSize: body, done: true, records: [] })
          const records = body as unknown[]
          return respond(200, { totalSize: records.length, done: true, records })
        }
      }
      return respond(400, [{ message: `unexpected query: ${soql}`, errorCode: 'MALFORMED_QUERY' }])
    }
    return respond(404, [{ message: 'not found', errorCode: 'NOT_FOUND' }])
  }
  return { client: new SalesforceClient({ instanceUrl: INSTANCE, accessToken: TOKEN, fetch }), calls }
}

const STAGES = [
  { ApiName: 'Prospecting', MasterLabel: 'Prospecting', SortOrder: 1, IsClosed: false, IsWon: false },
  { ApiName: 'Qualification', MasterLabel: 'Qualification', SortOrder: 2, IsClosed: false, IsWon: false },
  { ApiName: 'Closed Won', MasterLabel: 'Closed Won', SortOrder: 3, IsClosed: true, IsWon: true },
  { ApiName: 'Closed Lost', MasterLabel: 'Closed Lost', SortOrder: 4, IsClosed: true, IsWon: false },
]

function dealsAndHistory() {
  const deals: Array<{ Id: string; IsWon: boolean }> = []
  const history: Array<{ OpportunityId: string; StageName: string; CreatedDate: string }> = []
  for (let i = 0; i < 24; i++) {
    const id = `006${i}`
    const won = i < 14
    deals.push({ Id: id, IsWon: won })
    // Deals 0-1 skip Qualification; deal 20 moves backward; deals 22-23 are entered closed.
    let path = ['Prospecting', 'Qualification', won ? 'Closed Won' : 'Closed Lost']
    if (i < 2) path = ['Prospecting', 'Closed Won']
    if (i === 20) path = ['Prospecting', 'Qualification', 'Prospecting', 'Closed Lost']
    if (i >= 22) path = ['Closed Lost']
    path.forEach((s, step) => history.push({ OpportunityId: id, StageName: s, CreatedDate: daysAgo(100 - step) }))
  }
  return { deals, history }
}

function healthyRoutes(): Array<[string, unknown]> {
  const { deals, history } = dealsAndHistory()
  return [
    ['FROM Organization', [{ Id: '00D000000000001', Name: 'Acme Test', OrganizationType: 'Developer Edition', IsSandbox: false }]],
    ['FROM Project__c', 12],
    ['FROM Legacy__c', 0],
    ['FROM CustomField', 140],
    ['FROM FlowDefinitionView', [
      { ApiName: 'Lead_Route', IsActive: true, ProcessType: 'AutoLaunchedFlow', NamespacePrefix: null },
      { ApiName: 'Old_PB', IsActive: true, ProcessType: 'Workflow', NamespacePrefix: null },
      { ApiName: 'Draft', IsActive: false, ProcessType: 'Flow', NamespacePrefix: null },
      { ApiName: 'Vendor_Flow', IsActive: true, ProcessType: 'Flow', NamespacePrefix: 'vend' },
    ]],
    ['FROM User WHERE', [
      { Id: '005A', LastLoginDate: daysAgo(2), Profile: { UserLicense: { Name: 'Salesforce' } } },
      { Id: '005B', LastLoginDate: daysAgo(10), Profile: { UserLicense: { Name: 'Salesforce' } } },
      { Id: '005C', LastLoginDate: daysAgo(200), Profile: { UserLicense: { Name: 'Salesforce Platform' } } },
      { Id: '005D', LastLoginDate: null, Profile: { UserLicense: { Name: 'Salesforce Integration' } } },
    ]],
    ['PermissionsCustomizeApplication', [{ AssigneeId: '005A' }, { AssigneeId: '005C' }, { AssigneeId: '005A' }]],
    ['PermissionsViewAllData', [{ PermissionSetId: '0PS1' }, { PermissionSetId: '0PS1' }, { PermissionSetId: '0PS2' }]],
    ["QualifiedApiName = 'Account'", [{ QualifiedApiName: 'Name', IsFieldHistoryTracked: true }]],
    ["QualifiedApiName = 'Opportunity'", [{ QualifiedApiName: 'StageName', IsFieldHistoryTracked: true }]],
    ['FROM SetupAuditTrail', 7],
    ['FROM OpportunityStage', STAGES],
    ['FROM Opportunity WHERE', deals],
    ['FROM OpportunityHistory', history],
    ['FROM SecurityHealthCheckRisks', [{ Setting: 'Minimum password length', SettingGroup: 'Password Policies', OrgValue: '5', StandardValue: '8' }]],
    ['FROM SecurityHealthCheck', [{ Score: '71' }]],
    ['FROM UserLicense', [{ Name: 'Salesforce', TotalLicenses: 10, UsedLicenses: 3 }]],
  ]
}

const SOBJECTS = { sobjects: [
  { name: 'Account', custom: false, queryable: true },
  { name: 'Opportunity', custom: false, queryable: true },
  { name: 'Project__c', custom: true, queryable: true },
  { name: 'Legacy__c', custom: true, queryable: true },
  { name: 'vend__Thing__c', custom: true, queryable: true },
  { name: 'Project__Share', custom: true, queryable: true },
  { name: 'SomeEvent__e', custom: true, queryable: false },
] }
const LIMITS = { DailyApiRequests: { Max: 1000, Remaining: 100 }, DataStorageMB: { Max: 100, Remaining: 90 } }

test('scans a fake org into measured metrics with evidence', async () => {
  const { client, calls } = fakeOrg(healthyRoutes(), { sobjects: SOBJECTS, limits: LIMITS })
  const r = await scanSalesforceOrg(client, NOW)

  assert.equal(r.raw.connection.platform, 'salesforce')
  assert.equal(r.raw.connection.orgName, 'Acme Test')
  assert.equal(r.raw.schema.totalEntities, 6)
  assert.equal(r.raw.schema.customEntities, 2, 'managed and __Share objects are not own custom objects')
  assert.equal(r.raw.schema.unusedEntities, 1)
  assert.equal(r.raw.schema.totalFields, 140)

  assert.equal(r.raw.automation.totalFlows, 3, 'managed package flows are left out')
  assert.equal(r.raw.automation.activeFlows, 2)
  assert.equal(r.raw.automation.inactiveFlows, 1)
  assert.equal(r.raw.automation.deprecatedApiCalls, 1)

  assert.equal(r.raw.security.totalUsers, 4)
  assert.equal(r.raw.security.adminUsers, 2)
  assert.equal(r.raw.security.dormantAdmins, 1)
  assert.equal(r.raw.security.rolesWithExcessivePrivilege, 2)
  assert.equal(r.raw.security.auditLogEnabled, true)
  assert.equal(r.raw.security.usersWithoutMFA, null)

  assert.equal(r.raw.adoption.totalLicensedUsers, 3, 'integration licence is not a CRM seat')
  assert.equal(r.raw.adoption.monthlyActiveUsers, 2)
  assert.equal(r.raw.adoption.automationsPerActiveUser, 1)
  assert.equal(r.raw.adoption.recentCustomisations30d, 7)
  assert.equal(r.raw.adoption.featureUtilisationPct, null)

  assert.equal(r.raw.processFit?.closedDealsAnalysed, 24)
  assert.equal(r.raw.processFit?.wonDealsAnalysed, 14)
  assert.equal(r.raw.processFit?.skippedStageDeals, 2)
  assert.equal(r.raw.processFit?.backwardMoveDeals, 1)
  assert.equal(r.raw.processFit?.createdClosedDeals, 2)

  assert.equal(r.extras.securityHealthCheck?.score, 71)
  assert.equal(r.extras.securityHealthCheck?.highRiskSettings.length, 1)
  assert.deepEqual(r.extras.limitsNearMax?.map(l => l.name), ['DailyApiRequests'])

  // Every measured metric has evidence naming its source.
  for (const e of r.evidence) assert.ok(e.source.length > 0, `${e.metric} has a source`)
  assert.ok(r.evidence.some(e => e.metric === 'security.dormantAdmins' && e.sampleIds?.includes('005C')))

  // The token never leaves the Authorization header.
  assert.ok(calls.every(c => !c.includes(TOKEN)))
  assert.ok(!JSON.stringify(r).includes(TOKEN))
})

test('a refused query leaves only its metrics not measured', async () => {
  const routes = healthyRoutes().map(([m, b]): [string, unknown] =>
    m === 'PermissionsCustomizeApplication' ? [m, { error: 403, errorCode: 'INSUFFICIENT_ACCESS' }] : [m, b])
  const { client } = fakeOrg(routes, { sobjects: SOBJECTS, limits: LIMITS })
  const r = await scanSalesforceOrg(client, NOW)
  assert.equal(r.raw.security.adminUsers, null)
  assert.equal(r.raw.security.dormantAdmins, null)
  assert.equal(r.raw.security.totalUsers, 4, 'other security metrics still measured')
  const reason = r.notMeasured.find(n => n.metric === 'security.adminUsers')?.reason ?? ''
  assert.match(reason, /403/)

  const scored = scoreHealthPayload(r.raw)
  assert.ok(scored.dimensions.security.notMeasured.length > 0)
  assert.notEqual(scored.dimensions.security.score, null)
})

test('an org with too little deal history scores process fit as not measured', async () => {
  const routes = healthyRoutes().map(([m, b]): [string, unknown] => {
    if (m === 'FROM Opportunity WHERE') return [m, []]
    if (m === 'FROM OpportunityHistory') return [m, []]
    return [m, b]
  })
  const { client } = fakeOrg(routes, { sobjects: SOBJECTS, limits: LIMITS })
  const r = await scanSalesforceOrg(client, NOW)
  assert.equal(r.raw.processFit?.closedDealsAnalysed, null)
  const scored = scoreHealthPayload(r.raw)
  assert.equal(scored.dimensions.processFit.score, null)
  assert.equal(scored.dimensions.processFit.checksMeasured, 0)
  assert.ok(r.notMeasured.some(n => n.metric === 'processFit.closedDealsAnalysed' && /Only 0 closed deals/.test(n.reason)))
})

test('evidence file and summary carry scores but no token', async () => {
  const { client } = fakeOrg(healthyRoutes(), { sobjects: SOBJECTS, limits: LIMITS })
  const r = await scanSalesforceOrg(client, NOW)
  const scored = scoreHealthPayload(r.raw)
  const file = buildEvidenceFile(r, scored)
  assert.equal(file.platform, 'salesforce')
  assert.equal(file.org.id, '00D000000000001')
  const text = JSON.stringify(file)
  assert.ok(!text.includes(TOKEN))
  const summary = formatSummary(file)
  assert.match(summary, /Overall score: \d+/)
  assert.match(summary, /Process fit/i)
  assert.match(summary, /Security Health Check: 71/)
})

test('parses the scan command line', () => {
  assert.deepEqual(
    { ...parseArgs(['scan', 'salesforce', '--target-org', 'acme', '--out', 'reports', '--json']) },
    { out: 'reports', json: true, help: false, command: 'scan', platform: 'salesforce', targetOrg: 'acme' },
  )
  assert.equal(parseArgs(['salesforce', '-o', 'x']).targetOrg, 'x')
  assert.equal(parseArgs(['salesforce', '--target-org=y']).targetOrg, 'y')
})
