// ─── Salesforce health scan (first slice) ────────────────────────────────────
//
// Reads a Salesforce org through the REST, Tooling and limits APIs and builds
// Vytal's RawHealthPayload, plus an evidence trail for every metric: the query
// it came from, the value, and up to five sample record IDs. Nothing here
// writes to the org, and no record contents are kept: only counts, setup
// names, stage names and record IDs.
//
// Every metric is measured independently. If a query fails (a missing
// permission, an object the edition does not have), that metric stays null,
// so the scoring engine reports it as "not measured" instead of healthy, and
// the reason goes into `notMeasured`.

import type { RawHealthPayload, OrgConnection } from '../../src/types/health'
import { SalesforceClient, SalesforceApiError } from './client'
import { analyseProcessFit, type StageDef } from './processFit'

export interface EvidenceItem {
  /** Dotted metric key, e.g. `security.adminUsers`. */
  metric: string
  value: number | boolean | null
  /** The SOQL query or endpoint the value came from. */
  source: string
  note?: string
  sampleIds?: string[]
}

export interface NotMeasured {
  metric: string
  reason: string
}

/** Salesforce-only readings shown in the report but not scored yet. */
export interface SalesforceExtras {
  securityHealthCheck: {
    score: number | null
    highRiskSettings: Array<{ setting: string; group: string; orgValue: string; standardValue: string }>
  } | null
  limitsNearMax: Array<{ name: string; used: number; max: number; pctUsed: number }> | null
  licences: Array<{ name: string; used: number; total: number }> | null
}

export interface SalesforceScanResult {
  raw: RawHealthPayload
  evidence: EvidenceItem[]
  notMeasured: NotMeasured[]
  extras: SalesforceExtras
}

/** Full CRM licences counted as "licensed users" for adoption. */
export const CRM_LICENCE_NAMES = ['Salesforce', 'Salesforce Platform']

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_OBJECT_COUNTS = 400
const LIMIT_WARN_PCT = 80

export async function scanSalesforceOrg(client: SalesforceClient, now = new Date()): Promise<SalesforceScanResult> {
  const evidence: EvidenceItem[] = []
  const notMeasured: NotMeasured[] = []

  const record = (item: EvidenceItem) => { evidence.push(item) }
  const skip = (metric: string, err: unknown) => {
    notMeasured.push({ metric, reason: describeError(err) })
  }

  // ── Connection ────────────────────────────────────────────────────────────
  const orgQuery = 'SELECT Id, Name, OrganizationType, IsSandbox FROM Organization'
  const org = (await client.query<{ Id: string; Name: string; OrganizationType: string; IsSandbox: boolean }>(orgQuery)).records[0]
  if (!org) throw new Error('Could not read the Organization record; check that the login has API access.')
  const connection: OrgConnection = {
    id: org.Id,
    platform: 'salesforce',
    orgName: org.Name,
    orgUrl: client.instanceUrl,
    connectedAt: now,
  }

  const raw: RawHealthPayload = {
    connection,
    schema: {
      totalEntities: null, customEntities: null, unusedEntities: null, totalFields: null,
      unusedFields: null, deprecatedObjects: null, namingViolations: null,
    },
    automation: {
      totalFlows: null, activeFlows: null, inactiveFlows: null, circularDependencies: null,
      maxNestingDepth: null, flowsWithoutErrorHandling: null, deprecatedApiCalls: null,
    },
    dataQuality: {
      totalRecordsSampled: null, duplicateCount: null, incompleteRequiredFields: null,
      staleRecords30d: null, staleRecords90d: null,
    },
    security: {
      totalUsers: null, adminUsers: null, dormantAdmins: null, usersWithoutMFA: null,
      rolesWithExcessivePrivilege: null, auditLogEnabled: null,
    },
    adoption: {
      monthlyActiveUsers: null, totalLicensedUsers: null, featureUtilisationPct: null,
      automationsPerActiveUser: null, recentCustomisations30d: null,
    },
    processFit: {
      closedDealsAnalysed: null, wonDealsAnalysed: null, skippedStageDeals: null,
      backwardMoveDeals: null, createdClosedDeals: null,
    },
  }

  // ── Schema ────────────────────────────────────────────────────────────────
  try {
    const describe = await client.get<{ sobjects: Array<{ name: string; custom: boolean; queryable: boolean }> }>(
      `${client.apiPath()}/sobjects`)
    const queryable = describe.sobjects.filter(o => o.queryable)
    // Own custom objects: `Name__c` with no namespace. Managed package objects
    // (`ns__Name__c`) are the vendor's debt, not the org's, so they are counted apart.
    const custom = queryable.filter(o => o.custom && o.name.endsWith('__c'))
    const ownCustom = custom.filter(o => o.name.split('__').length === 2)
    raw.schema.totalEntities = queryable.length
    raw.schema.customEntities = ownCustom.length
    record({ metric: 'schema.totalEntities', value: queryable.length, source: 'GET /sobjects (describeGlobal), queryable objects' })
    record({
      metric: 'schema.customEntities', value: ownCustom.length, source: 'GET /sobjects (describeGlobal), custom objects ending __c with no namespace',
      note: `${custom.length - ownCustom.length} managed package objects not counted.`,
    })

    if (ownCustom.length > MAX_OBJECT_COUNTS) {
      notMeasured.push({ metric: 'schema.unusedEntities', reason: `${ownCustom.length} custom objects is more than this scan counts one by one (${MAX_OBJECT_COUNTS}).` })
    } else {
      const counts = await mapLimit(ownCustom, 5, async o => {
        try {
          return { name: o.name, count: await client.count(`SELECT COUNT() FROM ${o.name}`) }
        } catch {
          return { name: o.name, count: null as number | null }
        }
      })
      const failed = counts.filter(c => c.count === null).map(c => c.name)
      const unused = counts.filter(c => c.count === 0).map(c => c.name)
      if (failed.length > ownCustom.length * 0.1) {
        notMeasured.push({ metric: 'schema.unusedEntities', reason: `Could not count records on ${failed.length} of ${ownCustom.length} custom objects.` })
      } else {
        raw.schema.unusedEntities = unused.length
        record({
          metric: 'schema.unusedEntities', value: unused.length, source: 'SELECT COUNT() FROM <object> for each own custom object',
          note: [
            unused.length ? `Objects with no records: ${unused.slice(0, 20).join(', ')}${unused.length > 20 ? ', ...' : ''}.` : '',
            failed.length ? `Could not count ${failed.length}: ${failed.join(', ')}.` : '',
          ].filter(Boolean).join(' ') || undefined,
        })
      }
    }
  } catch (err) {
    skip('schema.totalEntities', err)
    skip('schema.customEntities', err)
    skip('schema.unusedEntities', err)
  }

  {
    const q = 'SELECT COUNT() FROM CustomField WHERE NamespacePrefix = null'
    try {
      const n = await client.count(q, { tooling: true })
      raw.schema.totalFields = n
      record({ metric: 'schema.totalFields', value: n, source: `Tooling: ${q}`, note: 'Custom fields the org owns; standard fields and managed package fields are not counted.' })
    } catch (err) { skip('schema.totalFields', err) }
  }

  // ── Automation ────────────────────────────────────────────────────────────
  let activeFlows: number | null = null
  {
    const q = 'SELECT ApiName, IsActive, ProcessType, NamespacePrefix FROM FlowDefinitionView'
    try {
      const flows = (await client.query<{ ApiName: string; IsActive: boolean; ProcessType: string; NamespacePrefix: string | null }>(q)).records
        .filter(f => !f.NamespacePrefix)
      const active = flows.filter(f => f.IsActive)
      const processBuilders = active.filter(f => f.ProcessType === 'Workflow')
      activeFlows = active.length
      raw.automation.totalFlows = flows.length
      raw.automation.activeFlows = active.length
      raw.automation.inactiveFlows = flows.length - active.length
      raw.automation.deprecatedApiCalls = processBuilders.length
      const src = `${q} (own namespace only; one row per flow, not per version)`
      record({ metric: 'automation.totalFlows', value: flows.length, source: src })
      record({ metric: 'automation.activeFlows', value: active.length, source: src })
      record({ metric: 'automation.inactiveFlows', value: flows.length - active.length, source: src })
      record({
        metric: 'automation.deprecatedApiCalls', value: processBuilders.length, source: src,
        note: 'Counts active Process Builder processes (ProcessType = Workflow). Workflow Rules are not counted yet.'
          + (processBuilders.length ? ` Processes: ${processBuilders.slice(0, 20).map(f => f.ApiName).join(', ')}.` : ''),
      })
    } catch (err) {
      for (const m of ['totalFlows', 'activeFlows', 'inactiveFlows', 'deprecatedApiCalls']) skip(`automation.${m}`, err)
    }
  }

  // ── Users, admins, adoption ───────────────────────────────────────────────
  let monthlyActive: number | null = null
  {
    const q = "SELECT Id, LastLoginDate, Profile.UserLicense.Name FROM User WHERE IsActive = true AND UserType = 'Standard'"
    try {
      const users = (await client.query<{ Id: string; LastLoginDate: string | null; Profile: { UserLicense: { Name: string } | null } | null }>(q)).records
      const loginById = new Map(users.map(u => [u.Id, u.LastLoginDate]))
      raw.security.totalUsers = users.length
      record({ metric: 'security.totalUsers', value: users.length, source: q })

      const licensed = users.filter(u => CRM_LICENCE_NAMES.includes(u.Profile?.UserLicense?.Name ?? ''))
      const active30 = licensed.filter(u => u.LastLoginDate && now.getTime() - Date.parse(u.LastLoginDate) <= 30 * DAY_MS)
      if (licensed.length > 0) {
        monthlyActive = active30.length
        raw.adoption.totalLicensedUsers = licensed.length
        raw.adoption.monthlyActiveUsers = active30.length
        const note = `Active users on ${CRM_LICENCE_NAMES.join(' or ')} licences; integration and other licence types left out.`
        record({ metric: 'adoption.totalLicensedUsers', value: licensed.length, source: q, note })
        record({ metric: 'adoption.monthlyActiveUsers', value: active30.length, source: `${q}; LastLoginDate within 30 days`, note })
      } else {
        const reason = `No active users on ${CRM_LICENCE_NAMES.join(' or ')} licences were found.`
        notMeasured.push({ metric: 'adoption.totalLicensedUsers', reason })
        notMeasured.push({ metric: 'adoption.monthlyActiveUsers', reason })
      }

      // Admins: anyone holding Modify All Data or Customize Application through
      // a profile or a permission set. Profiles show up here too, because each
      // profile owns a permission set (IsOwnedByProfile).
      const aq = "SELECT AssigneeId FROM PermissionSetAssignment WHERE Assignee.IsActive = true AND Assignee.UserType = 'Standard' AND (PermissionSet.PermissionsModifyAllData = true OR PermissionSet.PermissionsCustomizeApplication = true)"
      try {
        const assignments = (await client.query<{ AssigneeId: string }>(aq)).records
        const admins = [...new Set(assignments.map(a => a.AssigneeId))]
        const dormant = admins.filter(id => {
          const last = loginById.get(id)
          return !last || now.getTime() - Date.parse(last) > 90 * DAY_MS
        })
        raw.security.adminUsers = admins.length
        raw.security.dormantAdmins = dormant.length
        record({ metric: 'security.adminUsers', value: admins.length, source: aq })
        record({
          metric: 'security.dormantAdmins', value: dormant.length, source: `${aq}; LastLoginDate over 90 days ago or never`,
          sampleIds: dormant.slice(0, 5),
        })
      } catch (err) {
        skip('security.adminUsers', err)
        skip('security.dormantAdmins', err)
      }
    } catch (err) {
      for (const m of ['security.totalUsers', 'security.adminUsers', 'security.dormantAdmins', 'adoption.totalLicensedUsers', 'adoption.monthlyActiveUsers']) skip(m, err)
    }
  }

  if (activeFlows !== null && monthlyActive !== null && monthlyActive > 0) {
    const perUser = Math.round((activeFlows / monthlyActive) * 100) / 100
    raw.adoption.automationsPerActiveUser = perUser
    record({ metric: 'adoption.automationsPerActiveUser', value: perUser, source: 'automation.activeFlows / adoption.monthlyActiveUsers' })
  } else {
    notMeasured.push({ metric: 'adoption.automationsPerActiveUser', reason: 'Needs both active flows and at least one monthly active user.' })
  }

  {
    const q = 'SELECT PermissionSetId FROM PermissionSetAssignment WHERE Assignee.IsActive = true AND (PermissionSet.PermissionsModifyAllData = true OR PermissionSet.PermissionsViewAllData = true)'
    try {
      const rows = (await client.query<{ PermissionSetId: string }>(q)).records
      const sets = [...new Set(rows.map(r => r.PermissionSetId))]
      raw.security.rolesWithExcessivePrivilege = sets.length
      record({
        metric: 'security.rolesWithExcessivePrivilege', value: sets.length, source: q,
        note: 'Profiles and permission sets granting Modify All Data or View All Data that at least one active user holds.',
        sampleIds: sets.slice(0, 5),
      })
    } catch (err) { skip('security.rolesWithExcessivePrivilege', err) }
  }

  // Salesforce always keeps Setup Audit Trail, so "audit logging" here means
  // field history tracking on the objects where data changes matter most.
  {
    const objects = ['Account', 'Opportunity']
    try {
      const tracked: Record<string, number> = {}
      for (const obj of objects) {
        const q = `SELECT QualifiedApiName, IsFieldHistoryTracked FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${obj}'`
        const fields = (await client.query<{ QualifiedApiName: string; IsFieldHistoryTracked: boolean }>(q, { tooling: true })).records
        tracked[obj] = fields.filter(f => f.IsFieldHistoryTracked).length
      }
      const enabled = objects.every(o => tracked[o] > 0)
      raw.security.auditLogEnabled = enabled
      record({
        metric: 'security.auditLogEnabled', value: enabled,
        source: "Tooling: SELECT QualifiedApiName, IsFieldHistoryTracked FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '<object>'",
        note: `Fields with history tracking: ${objects.map(o => `${o} ${tracked[o]}`).join(', ')}. Setup Audit Trail is always on in Salesforce, so this checks field history instead.`,
      })
    } catch (err) { skip('security.auditLogEnabled', err) }
  }

  {
    const q = 'SELECT COUNT() FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:30'
    try {
      const n = await client.count(q)
      raw.adoption.recentCustomisations30d = n
      record({ metric: 'adoption.recentCustomisations30d', value: n, source: q })
    } catch (err) { skip('adoption.recentCustomisations30d', err) }
  }

  // ── Process fit ───────────────────────────────────────────────────────────
  await scanProcessFit(client, raw, record, notMeasured)

  // ── Extras: reported, not scored yet ──────────────────────────────────────
  const extras: SalesforceExtras = { securityHealthCheck: null, limitsNearMax: null, licences: null }
  try {
    const score = (await client.query<{ Score: string | number }>('SELECT Score FROM SecurityHealthCheck', { tooling: true })).records[0]?.Score
    const risks = (await client.query<{ Setting: string; SettingGroup: string; OrgValue: string; StandardValue: string }>(
      "SELECT Setting, SettingGroup, OrgValue, StandardValue FROM SecurityHealthCheckRisks WHERE RiskType = 'HIGH_RISK'", { tooling: true })).records
    extras.securityHealthCheck = {
      score: score === undefined || score === null ? null : Number(score),
      highRiskSettings: risks.map(r => ({ setting: r.Setting, group: r.SettingGroup, orgValue: r.OrgValue, standardValue: r.StandardValue })),
    }
  } catch (err) { notMeasured.push({ metric: 'extras.securityHealthCheck', reason: describeError(err) }) }

  try {
    const limits = await client.get<Record<string, { Max: number; Remaining: number }>>(`${client.apiPath()}/limits`)
    extras.limitsNearMax = Object.entries(limits)
      .filter(([, v]) => typeof v?.Max === 'number' && v.Max > 0)
      .map(([name, v]) => ({ name, used: v.Max - v.Remaining, max: v.Max, pctUsed: Math.round(((v.Max - v.Remaining) / v.Max) * 100) }))
      .filter(l => l.pctUsed >= LIMIT_WARN_PCT)
      .sort((a, b) => b.pctUsed - a.pctUsed)
  } catch (err) { notMeasured.push({ metric: 'extras.limitsNearMax', reason: describeError(err) }) }

  try {
    const rows = (await client.query<{ Name: string; TotalLicenses: number; UsedLicenses: number }>(
      "SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense WHERE Status = 'Active'")).records
    extras.licences = rows
      .filter(r => r.TotalLicenses > 0)
      .map(r => ({ name: r.Name, used: r.UsedLicenses, total: r.TotalLicenses }))
      .sort((a, b) => b.total - a.total)
  } catch (err) { notMeasured.push({ metric: 'extras.licences', reason: describeError(err) }) }

  // Metrics this slice does not attempt yet, so the report says why.
  for (const metric of [
    'schema.unusedFields', 'schema.deprecatedObjects', 'schema.namingViolations',
    'automation.circularDependencies', 'automation.maxNestingDepth', 'automation.flowsWithoutErrorHandling',
    'dataQuality.totalRecordsSampled', 'dataQuality.duplicateCount', 'dataQuality.incompleteRequiredFields',
    'dataQuality.staleRecords30d', 'dataQuality.staleRecords90d',
    'security.usersWithoutMFA', 'adoption.featureUtilisationPct',
  ]) {
    notMeasured.push({ metric, reason: 'Not in the first Salesforce slice yet.' })
  }

  return { raw, evidence, notMeasured, extras }
}

async function scanProcessFit(
  client: SalesforceClient,
  raw: RawHealthPayload,
  record: (e: EvidenceItem) => void,
  notMeasured: NotMeasured[],
): Promise<void> {
  const metrics = ['closedDealsAnalysed', 'wonDealsAnalysed', 'skippedStageDeals', 'backwardMoveDeals', 'createdClosedDeals'] as const
  const skipAll = (reason: string) => { for (const m of metrics) notMeasured.push({ metric: `processFit.${m}`, reason }) }

  let stages: StageDef[]
  try {
    stages = await readStages(client)
  } catch (err) {
    skipAll(describeError(err))
    return
  }

  const dealsQuery = 'SELECT Id, IsWon FROM Opportunity WHERE IsClosed = true AND CloseDate = LAST_N_DAYS:365 ORDER BY CloseDate DESC'
  const historyQuery = 'SELECT OpportunityId, StageName, CreatedDate FROM OpportunityHistory WHERE Opportunity.IsClosed = true AND Opportunity.CloseDate = LAST_N_DAYS:365'
  let deals: Array<{ Id: string; IsWon: boolean }>
  let history: Array<{ OpportunityId: string; StageName: string; CreatedDate: string }>
  let dealsTruncated = false
  try {
    const d = await client.query<{ Id: string; IsWon: boolean }>(dealsQuery, { maxRecords: 5000 })
    deals = d.records
    dealsTruncated = d.truncated
    history = (await client.query<{ OpportunityId: string; StageName: string; CreatedDate: string }>(historyQuery, { maxRecords: 100000 })).records
  } catch (err) {
    skipAll(describeError(err))
    return
  }

  const result = analyseProcessFit(
    stages,
    deals.map(d => ({ id: d.Id, isWon: d.IsWon })),
    history.map(h => ({ opportunityId: h.OpportunityId, stage: h.StageName, createdDate: h.CreatedDate })),
  )

  const pf = raw.processFit!
  for (const m of metrics) pf[m] = result[m]

  if (result.notMeasuredReason) {
    skipAll(result.notMeasuredReason)
    return
  }

  const source = `${dealsQuery}; ${historyQuery}`
  const window = `Deals closed in the last 365 days${dealsTruncated ? ' (most recent 5,000 only)' : ''}.`
  const unknown = result.unknownStages.length ? ` Stages in history that are no longer active were ignored for ordering: ${result.unknownStages.join(', ')}.` : ''
  record({ metric: 'processFit.closedDealsAnalysed', value: result.closedDealsAnalysed, source, note: window + unknown })
  record({ metric: 'processFit.backwardMoveDeals', value: result.backwardMoveDeals, source, note: 'Deals that moved from an open stage to an earlier open stage at least once.', sampleIds: result.samples.backward })
  record({ metric: 'processFit.createdClosedDeals', value: result.createdClosedDeals, source, note: 'Deals whose first recorded stage was already closed.', sampleIds: result.samples.createdClosed })
  if (result.skippedNotMeasuredReason) {
    notMeasured.push({ metric: 'processFit.wonDealsAnalysed', reason: result.skippedNotMeasuredReason })
    notMeasured.push({ metric: 'processFit.skippedStageDeals', reason: result.skippedNotMeasuredReason })
  } else {
    record({ metric: 'processFit.wonDealsAnalysed', value: result.wonDealsAnalysed, source, note: 'Won deals that passed through at least one open stage.' })
    record({
      metric: 'processFit.skippedStageDeals', value: result.skippedStageDeals, source,
      note: `Usual path (open stages at least half of won deals pass through): ${result.usualPath.join(' > ') || 'none'}.`,
      sampleIds: result.samples.skipped,
    })
  }
}

async function readStages(client: SalesforceClient): Promise<StageDef[]> {
  type Row = { ApiName?: string; MasterLabel: string; SortOrder: number; IsClosed: boolean; IsWon: boolean }
  let rows: Row[]
  try {
    rows = (await client.query<Row>('SELECT ApiName, MasterLabel, SortOrder, IsClosed, IsWon FROM OpportunityStage WHERE IsActive = true ORDER BY SortOrder')).records
  } catch (err) {
    // Older API surfaces may not expose ApiName; history stores the value,
    // which usually equals the label in that case.
    if (!(err instanceof SalesforceApiError) || err.errorCode !== 'INVALID_FIELD') throw err
    rows = (await client.query<Row>('SELECT MasterLabel, SortOrder, IsClosed, IsWon FROM OpportunityStage WHERE IsActive = true ORDER BY SortOrder')).records
  }
  return rows.map(r => ({
    value: r.ApiName ?? r.MasterLabel,
    label: r.MasterLabel,
    sortOrder: r.SortOrder,
    isClosed: r.IsClosed,
    isWon: r.IsWon,
  }))
}

function describeError(err: unknown): string {
  if (err instanceof SalesforceApiError) {
    if (err.status === 401) return 'The login was refused (401). Log in again with the Salesforce CLI.'
    if (err.status === 403) return `Not permitted (403)${err.errorCode ? `, ${err.errorCode}` : ''}. The scanning user may lack a permission.`
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}
