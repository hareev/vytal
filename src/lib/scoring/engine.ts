import type { RawHealthPayload, ScoredHealthPayload, DimensionScore, Issue, IssueSeverity } from '@/types/health'

// ─── Scoring engine ───────────────────────────────────────────────────────────
//
// Each dimension is scored 0–100 using a weighted rule set.
// Rules fire against the raw payload and produce issues.
// The dimension score is 100 minus the sum of rule penalties, floored at 0.

export function scoreHealthPayload(raw: RawHealthPayload): ScoredHealthPayload {
  const schema = scoreSchema(raw)
  const automation = scoreAutomation(raw)
  const dataQuality = scoreDataQuality(raw)
  const security = scoreSecurity(raw)
  const adoption = scoreAdoption(raw)

  const overallScore = Math.round(
    (schema.score * 0.25) +
    (automation.score * 0.25) +
    (dataQuality.score * 0.20) +
    (security.score * 0.20) +
    (adoption.score * 0.10)
  )

  return {
    connection: raw.connection,
    overallScore,
    dimensions: { schema, automation, dataQuality, security, adoption },
    scannedAt: new Date(),
  }
}

// ─── Schema hygiene ───────────────────────────────────────────────────────────

function scoreSchema(raw: RawHealthPayload): DimensionScore {
  const issues: Issue[] = []
  let penalty = 0

  const customRatio = raw.schema.customEntities / Math.max(raw.schema.totalEntities, 1)
  if (customRatio > 0.5) {
    const p = 15
    penalty += p
    issues.push(issue('critical', 'schema', 'High custom entity ratio',
      `${Math.round(customRatio * 100)}% of entities are custom (${raw.schema.customEntities}/${raw.schema.totalEntities}). High customisation debt increases upgrade risk.`,
      raw.schema.customEntities, 'Review entities against current business requirements. Archive or deprecate unused ones.'))
  }

  if (raw.schema.unusedEntities > 0) {
    const p = Math.min(raw.schema.unusedEntities * 2, 20)
    penalty += p
    issues.push(issue('high', 'schema', `${raw.schema.unusedEntities} unused custom entities`,
      'Unused entities bloat the schema, slow solution imports, and confuse developers.',
      raw.schema.unusedEntities, 'Run a solution usage analysis and remove entities with no records, flows, or form references.'))
  }

  if (raw.schema.deprecatedObjects > 0) {
    penalty += 10
    issues.push(issue('critical', 'schema', `${raw.schema.deprecatedObjects} deprecated objects in use`,
      'Using deprecated entities or fields will cause failures when Microsoft removes them.',
      raw.schema.deprecatedObjects, 'Migrate to supported alternatives before the next deprecation wave.'))
  }

  if (raw.schema.namingViolations > 5) {
    const p = Math.min(raw.schema.namingViolations, 10)
    penalty += p
    issues.push(issue('medium', 'schema', `${raw.schema.namingViolations} naming convention violations`,
      'Inconsistent naming makes the schema harder to maintain and onboard new developers.'))
  }

  return { score: clamp(100 - penalty), label: 'Schema hygiene', issues }
}

// ─── Automation complexity ────────────────────────────────────────────────────

function scoreAutomation(raw: RawHealthPayload): DimensionScore {
  const issues: Issue[] = []
  let penalty = 0

  if (raw.automation.circularDependencies > 0) {
    penalty += 25
    issues.push(issue('critical', 'automation', `${raw.automation.circularDependencies} circular flow dependencies`,
      'Circular triggers create infinite loops that can crash your org under load.',
      raw.automation.circularDependencies, 'Map the dependency graph and break cycles by adding condition guards or restructuring trigger logic.'))
  }

  const inactiveRatio = raw.automation.inactiveFlows / Math.max(raw.automation.totalFlows, 1)
  if (inactiveRatio > 0.15) {
    const p = Math.round(inactiveRatio * 20)
    penalty += p
    issues.push(issue('medium', 'automation', `${raw.automation.inactiveFlows} inactive flows`,
      `${Math.round(inactiveRatio * 100)}% of flows are inactive — cluttering the environment and confusing teams.`,
      raw.automation.inactiveFlows, 'Delete or archive flows that are no longer needed.'))
  }

  if (raw.automation.flowsWithoutErrorHandling > 0) {
    const p = Math.min(raw.automation.flowsWithoutErrorHandling * 3, 20)
    penalty += p
    issues.push(issue('high', 'automation', `${raw.automation.flowsWithoutErrorHandling} flows without error handling`,
      'Silent failures in production automations are the #1 cause of data integrity issues.',
      raw.automation.flowsWithoutErrorHandling, 'Add a "Run After" error branch or a dedicated error notification flow.'))
  }

  if (raw.automation.deprecatedApiCalls > 0) {
    penalty += 15
    issues.push(issue('critical', 'automation', `${raw.automation.deprecatedApiCalls} deprecated API calls in flows/plugins`,
      'These will fail when Microsoft removes the deprecated endpoint — without warning in production.',
      raw.automation.deprecatedApiCalls, 'Update to the current Web API v9.2 endpoints.'))
  }

  return { score: clamp(100 - penalty), label: 'Automation complexity', issues }
}

// ─── Data quality ─────────────────────────────────────────────────────────────

function scoreDataQuality(raw: RawHealthPayload): DimensionScore {
  const issues: Issue[] = []
  let penalty = 0

  if (raw.dataQuality.duplicateCount > 0) {
    const dupeRatio = raw.dataQuality.duplicateCount / Math.max(raw.dataQuality.totalRecordsSampled, 1)
    if (dupeRatio > 0.05) {
      const p = Math.min(Math.round(dupeRatio * 100), 30)
      penalty += p
      issues.push(issue('high', 'dataQuality', `${raw.dataQuality.duplicateCount} duplicate records detected`,
        `${Math.round(dupeRatio * 100)}% duplicate rate in sampled records — degrades trust in CRM data and distorts reporting.`,
        raw.dataQuality.duplicateCount, 'Enable duplicate detection rules and run a bulk merge job for existing duplicates.'))
    }
  }

  if (raw.dataQuality.incompleteRequiredFields > 10) {
    const p = Math.min(raw.dataQuality.incompleteRequiredFields, 25)
    penalty += p
    issues.push(issue('medium', 'dataQuality', `${raw.dataQuality.incompleteRequiredFields}% of records have incomplete required fields`,
      'Incomplete records break downstream automation triggers and reduce AI-readable signal quality.'))
  }

  return { score: clamp(100 - penalty), label: 'Data quality', issues }
}

// ─── Security posture ─────────────────────────────────────────────────────────

function scoreSecurity(raw: RawHealthPayload): DimensionScore {
  const issues: Issue[] = []
  let penalty = 0

  if (raw.security.dormantAdmins > 0) {
    penalty += raw.security.dormantAdmins * 8
    issues.push(issue('critical', 'security', `${raw.security.dormantAdmins} dormant admin accounts`,
      'Admin accounts with no activity in 90+ days are a standing attack surface.',
      raw.security.dormantAdmins, 'Disable or downgrade accounts. Enforce quarterly access reviews.'))
  }

  const adminRatio = raw.security.adminUsers / Math.max(raw.security.totalUsers, 1)
  if (adminRatio > 0.1 && raw.security.adminUsers > 3) {
    const p = Math.min(Math.round(adminRatio * 50), 20)
    penalty += p
    issues.push(issue('high', 'security', `${raw.security.adminUsers} users with System Administrator role`,
      `${Math.round(adminRatio * 100)}% of users are admins. Principle of least privilege is not being enforced.`,
      raw.security.adminUsers, 'Create custom security roles scoped to actual job functions.'))
  }

  if (!raw.security.auditLogEnabled) {
    penalty += 15
    issues.push(issue('high', 'security', 'Audit logging is disabled',
      'Without audit logs you have no forensic trail for data changes — a compliance risk in regulated industries.', undefined,
      'Enable audit logging in System Settings > Auditing.'))
  }

  return { score: clamp(100 - penalty), label: 'Security posture', issues }
}

// ─── Adoption health ──────────────────────────────────────────────────────────

function scoreAdoption(raw: RawHealthPayload): DimensionScore {
  const issues: Issue[] = []
  let penalty = 0

  const activeRatio = raw.adoption.monthlyActiveUsers / Math.max(raw.adoption.totalLicensedUsers, 1)
  if (activeRatio < 0.6) {
    const p = Math.round((1 - activeRatio) * 40)
    penalty += p
    issues.push(issue('high', 'adoption', `Only ${Math.round(activeRatio * 100)}% of licensed users are active`,
      'Low adoption means you are paying for licenses that aren\'t delivering value.',
      raw.adoption.totalLicensedUsers - raw.adoption.monthlyActiveUsers,
      'Identify inactive users, gather feedback, and drive adoption through training or role-specific UX improvements.'))
  }

  if (raw.adoption.featureUtilisationPct < 40) {
    penalty += 10
    issues.push(issue('medium', 'adoption', `Feature utilisation at ${raw.adoption.featureUtilisationPct}%`,
      'Key platform capabilities are unused — the org is not getting ROI from its CRM investment.'))
  }

  return { score: clamp(100 - penalty), label: 'Adoption health', issues }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _issueSeq = 0
function issue(
  severity: IssueSeverity,
  dimension: Issue['dimension'],
  title: string,
  description: string,
  affectedCount?: number,
  remediationHint?: string
): Issue {
  return {
    id: `issue-${++_issueSeq}`,
    severity,
    dimension,
    title,
    description,
    affectedCount,
    remediationHint,
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
