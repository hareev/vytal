import type { RawHealthPayload, ScoredHealthPayload, DimensionScore, Issue, IssueSeverity, CRMPlatform } from '@/types/health'

// ─── Scoring engine ───────────────────────────────────────────────────────────
//
// Each dimension is scored 0–100 using a weighted rule set.
// Rules fire against the raw payload and produce issues.
// The dimension score is 100 minus the sum of rule penalties, floored at 0.
//
// A rule only runs when every input it needs was measured (not null). A rule
// whose inputs are missing is listed in `notMeasured` and neither costs nor
// earns points. A dimension with no measured checks scores null, and the
// overall score is weighted over measured dimensions only.

// Process fit takes 25% of the overall score when it is measured. The other
// five keep their original proportions (25 : 25 : 20 : 20 : 10), so a scan
// that cannot measure process fit, such as Dynamics 365 today, scores exactly
// as it did before this dimension existed. Whole-number weights keep the
// arithmetic exact, so rounding at .5 cannot drift between versions.
const WEIGHTS = {
  schema: 75,
  automation: 75,
  dataQuality: 60,
  security: 60,
  adoption: 30,
  processFit: 100,
} as const

const WEIGHT_TOTAL = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)

/** Each dimension's share of the overall score when every dimension is measured (sums to 1). */
export const DIMENSION_WEIGHTS: Record<keyof typeof WEIGHTS, number> = Object.fromEntries(
  Object.entries(WEIGHTS).map(([k, w]) => [k, w / WEIGHT_TOTAL]),
) as Record<keyof typeof WEIGHTS, number>

export function scoreHealthPayload(raw: RawHealthPayload): ScoredHealthPayload {
  const dimensions = {
    schema: scoreSchema(raw),
    automation: scoreAutomation(raw),
    dataQuality: scoreDataQuality(raw),
    security: scoreSecurity(raw),
    adoption: scoreAdoption(raw),
    processFit: scoreProcessFit(raw),
  }

  let weighted = 0
  let weightUsed = 0
  let checksMeasured = 0
  let checksTotal = 0
  for (const key of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
    const dim = dimensions[key]
    checksMeasured += dim.checksMeasured
    checksTotal += dim.checksTotal
    if (dim.score !== null) {
      weighted += dim.score * WEIGHTS[key]
      weightUsed += WEIGHTS[key]
    }
  }

  return {
    connection: raw.connection,
    overallScore: weightUsed > 0 ? Math.round(weighted / weightUsed) : null,
    checksMeasured,
    checksTotal,
    raw,
    dimensions,
    scannedAt: new Date(),
  }
}

// ─── Dimension builder ────────────────────────────────────────────────────────

type NonNullTuple<T extends readonly unknown[]> = { -readonly [K in keyof T]: NonNullable<T[K]> }

class Dimension {
  readonly issues: Issue[] = []
  private penalty = 0
  private measured = 0
  private total = 0
  private readonly skipped: string[] = []

  constructor(private readonly label: string) {}

  /**
   * Run a rule only if all of its inputs were measured. `run` receives the
   * inputs with null removed and returns the penalty it applies (0 if none).
   */
  check<T extends readonly unknown[]>(name: string, inputs: T, run: (...values: NonNullTuple<T>) => number): void {
    this.total++
    if (inputs.some(v => v === null || v === undefined)) {
      this.skipped.push(name)
      return
    }
    this.measured++
    this.penalty += run(...(inputs as unknown as NonNullTuple<T>))
  }

  add(i: Issue): void {
    this.issues.push(i)
  }

  result(): DimensionScore {
    return {
      score: this.measured === 0 ? null : clamp(100 - this.penalty),
      label: this.label,
      issues: this.issues,
      checksMeasured: this.measured,
      checksTotal: this.total,
      notMeasured: this.skipped,
    }
  }
}

// ─── Platform wording ─────────────────────────────────────────────────────────
//
// Rule thresholds are shared across platforms so scores stay comparable, but
// titles and remediation hints must name the platform's own features.
// Dynamics 365 wording is the default and is unchanged.

function byPlatform(platform: CRMPlatform, dynamics: string, salesforce: string): string {
  return platform === 'salesforce' ? salesforce : dynamics
}

// ─── Schema hygiene ───────────────────────────────────────────────────────────

function scoreSchema(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Schema hygiene')
  const s = raw.schema

  d.check('Custom entity ratio', [s.customEntities, s.totalEntities] as const, (custom, total) => {
    const customRatio = custom / Math.max(total, 1)
    if (customRatio <= 0.5) return 0
    d.add(issue('critical', 'schema', 'High custom entity ratio',
      `${Math.round(customRatio * 100)}% of entities are custom (${custom}/${total}). High customisation debt increases upgrade risk.`,
      custom, 'Review entities against current business requirements. Archive or deprecate unused ones.'))
    return 15
  })

  d.check('Unused custom entities', [s.unusedEntities] as const, (unused) => {
    if (unused <= 0) return 0
    d.add(issue('high', 'schema', `${unused} unused custom entities`,
      'Unused entities bloat the schema, slow solution imports, and confuse developers.',
      unused, byPlatform(raw.connection.platform,
        'Run a solution usage analysis and remove entities with no records, flows, or form references.',
        'Check each object with no records for references in flows, Apex and layouts (Where is this used?), then archive or delete it.')))
    return Math.min(unused * 2, 20)
  })

  d.check('Deprecated objects', [s.deprecatedObjects] as const, (deprecated) => {
    if (deprecated <= 0) return 0
    d.add(issue('critical', 'schema', `${deprecated} deprecated objects in use`,
      'Using deprecated entities or fields will cause failures when Microsoft removes them.',
      deprecated, 'Migrate to supported alternatives before the next deprecation wave.'))
    return 10
  })

  d.check('Naming conventions', [s.namingViolations] as const, (violations) => {
    if (violations <= 5) return 0
    d.add(issue('medium', 'schema', `${violations} naming convention violations`,
      'Inconsistent naming makes the schema harder to maintain and onboard new developers.'))
    return Math.min(violations, 10)
  })

  return d.result()
}

// ─── Automation complexity ────────────────────────────────────────────────────

function scoreAutomation(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Automation complexity')
  const a = raw.automation

  d.check('Circular dependencies', [a.circularDependencies] as const, (circular) => {
    if (circular <= 0) return 0
    d.add(issue('critical', 'automation', `${circular} circular flow dependencies`,
      'Circular triggers create infinite loops that can crash your org under load.',
      circular, 'Map the dependency graph and break cycles by adding condition guards or restructuring trigger logic.'))
    return 25
  })

  d.check('Inactive flows', [a.inactiveFlows, a.totalFlows] as const, (inactive, total) => {
    const inactiveRatio = inactive / Math.max(total, 1)
    if (inactiveRatio <= 0.15) return 0
    d.add(issue('medium', 'automation', `${inactive} inactive flows`,
      `${Math.round(inactiveRatio * 100)}% of flows are inactive — cluttering the environment and confusing teams.`,
      inactive, 'Delete or archive flows that are no longer needed.'))
    return Math.round(inactiveRatio * 20)
  })

  d.check('Error handling', [a.flowsWithoutErrorHandling] as const, (missing) => {
    if (missing <= 0) return 0
    d.add(issue('high', 'automation', `${missing} flows without error handling`,
      'Silent failures in production automations are the #1 cause of data integrity issues.',
      missing, 'Add a "Run After" error branch or a dedicated error notification flow.'))
    return Math.min(missing * 3, 20)
  })

  d.check('Deprecated API calls', [a.deprecatedApiCalls] as const, (deprecated) => {
    if (deprecated <= 0) return 0
    const p = raw.connection.platform
    d.add(issue('critical', 'automation', byPlatform(p,
        `${deprecated} deprecated API calls in flows/plugins`,
        `${deprecated} active Process Builder processes`),
      byPlatform(p,
        'These will fail when Microsoft removes the deprecated endpoint — without warning in production.',
        'Salesforce has retired Process Builder in favour of Flow. Active processes still run but get no fixes and block a clean automation model.'),
      deprecated, byPlatform(p,
        'Update to the current Web API v9.2 endpoints.',
        'Use the Migrate to Flow tool in Setup, starting with processes on high-volume objects.')))
    return 15
  })

  return d.result()
}

// ─── Data quality ─────────────────────────────────────────────────────────────

function scoreDataQuality(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Data quality')
  const q = raw.dataQuality

  d.check('Duplicate records', [q.duplicateCount, q.totalRecordsSampled] as const, (dupes, sampled) => {
    if (dupes <= 0) return 0
    const dupeRatio = dupes / Math.max(sampled, 1)
    if (dupeRatio <= 0.05) return 0
    d.add(issue('high', 'dataQuality', `${dupes} duplicate records detected`,
      `${Math.round(dupeRatio * 100)}% duplicate rate in sampled records — degrades trust in CRM data and distorts reporting.`,
      dupes, 'Enable duplicate detection rules and run a bulk merge job for existing duplicates.'))
    return Math.min(Math.round(dupeRatio * 100), 30)
  })

  d.check('Required field completeness', [q.incompleteRequiredFields] as const, (incompletePct) => {
    if (incompletePct <= 10) return 0
    d.add(issue('medium', 'dataQuality', `${incompletePct}% of records have incomplete required fields`,
      'Incomplete records break downstream automation triggers and reduce AI-readable signal quality.'))
    return Math.min(incompletePct, 25)
  })

  return d.result()
}

// ─── Security posture ─────────────────────────────────────────────────────────

function scoreSecurity(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Security posture')
  const s = raw.security

  d.check('Dormant admins', [s.dormantAdmins] as const, (dormant) => {
    if (dormant <= 0) return 0
    d.add(issue('critical', 'security', `${dormant} dormant admin accounts`,
      'Admin accounts with no activity in 90+ days are a standing attack surface.',
      dormant, 'Disable or downgrade accounts. Enforce quarterly access reviews.'))
    return dormant * 8
  })

  d.check('Admin ratio', [s.adminUsers, s.totalUsers] as const, (admins, total) => {
    const adminRatio = admins / Math.max(total, 1)
    if (adminRatio <= 0.1 || admins <= 3) return 0
    d.add(issue('high', 'security', byPlatform(raw.connection.platform,
        `${admins} users with System Administrator role`,
        `${admins} users with Modify All Data or Customize Application`),
      `${Math.round(adminRatio * 100)}% of users are admins. Principle of least privilege is not being enforced.`,
      admins, 'Create custom security roles scoped to actual job functions.'))
    return Math.min(Math.round(adminRatio * 50), 20)
  })

  d.check('Audit logging', [s.auditLogEnabled] as const, (enabled) => {
    if (enabled) return 0
    const p = raw.connection.platform
    d.add(issue('high', 'security', byPlatform(p,
        'Audit logging is disabled',
        'No field history tracking on Account and Opportunity'),
      'Without audit logs you have no forensic trail for data changes — a compliance risk in regulated industries.', undefined,
      byPlatform(p,
        'Enable audit logging in System Settings > Auditing.',
        'Turn on Field History Tracking for the key fields on Account and Opportunity (owner, stage, amount, close date).')))
    return 15
  })

  return d.result()
}

// ─── Adoption health ──────────────────────────────────────────────────────────

function scoreAdoption(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Adoption health')
  const a = raw.adoption

  d.check('Active vs licensed users', [a.monthlyActiveUsers, a.totalLicensedUsers] as const, (active, licensed) => {
    const activeRatio = active / Math.max(licensed, 1)
    if (activeRatio >= 0.6) return 0
    d.add(issue('high', 'adoption', `Only ${Math.round(activeRatio * 100)}% of licensed users are active`,
      'Low adoption means you are paying for licenses that aren\'t delivering value.',
      licensed - active,
      'Identify inactive users, gather feedback, and drive adoption through training or role-specific UX improvements.'))
    return Math.round((1 - activeRatio) * 40)
  })

  d.check('Feature utilisation', [a.featureUtilisationPct] as const, (pct) => {
    if (pct >= 40) return 0
    d.add(issue('medium', 'adoption', `Feature utilisation at ${pct}%`,
      'Key platform capabilities are unused — the org is not getting ROI from its CRM investment.'))
    return 10
  })

  return d.result()
}

// ─── Process fit ──────────────────────────────────────────────────────────────
//
// Compares the sales process as built with how deals actually moved, from
// stage history. Thresholds are a first cut and should be tuned against real
// orgs; the connector leaves these inputs null when there are too few closed
// deals to judge.

function scoreProcessFit(raw: RawHealthPayload): DimensionScore {
  const d = new Dimension('Process fit')
  const f = raw.processFit ?? {
    closedDealsAnalysed: null, wonDealsAnalysed: null, skippedStageDeals: null,
    backwardMoveDeals: null, createdClosedDeals: null,
  }

  d.check('Stage skipping', [f.skippedStageDeals, f.wonDealsAnalysed] as const, (skipped, won) => {
    const ratio = skipped / Math.max(won, 1)
    if (ratio <= 0.2) return 0
    d.add(issue('high', 'processFit', `${Math.round(ratio * 100)}% of won deals skipped a usual stage`,
      `${skipped} of ${won} won deals never passed through a stage that most won deals go through. Either the stage does not reflect how the team sells, or deals are being pushed to closed without the work it stands for.`,
      skipped, 'Walk through a few of these deals with the sales lead: drop or merge stages the team does not use, or make the stage meaningful with entry criteria and a Path guidance.'))
    return Math.min(Math.round(ratio * 40), 25)
  })

  d.check('Backward stage moves', [f.backwardMoveDeals, f.closedDealsAnalysed] as const, (backward, total) => {
    const ratio = backward / Math.max(total, 1)
    if (ratio <= 0.15) return 0
    d.add(issue('medium', 'processFit', `${Math.round(ratio * 100)}% of deals moved back a stage`,
      `${backward} of ${total} closed deals went back to an earlier stage at least once. Frequent backward moves usually mean stage definitions are unclear or the order does not match the real buying process.`,
      backward, 'Agree written exit criteria for each stage and check whether the stage order matches how customers actually buy.'))
    return Math.min(Math.round(ratio * 30), 20)
  })

  d.check('Deals created already closed', [f.createdClosedDeals, f.closedDealsAnalysed] as const, (createdClosed, total) => {
    const ratio = createdClosed / Math.max(total, 1)
    if (ratio <= 0.2) return 0
    d.add(issue('medium', 'processFit', `${Math.round(ratio * 100)}% of deals were entered already closed`,
      `${createdClosed} of ${total} closed deals have no open stage in their history. They were logged after the fact, so the CRM is a record of outcomes, not a tool the team works deals in.`,
      createdClosed, 'Find out which teams log deals after closing and why: missing mobile access, duplicate entry with another tool, or a pipeline nobody reviews.'))
    return Math.min(Math.round(ratio * 30), 20)
  })

  return d.result()
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
