// ─── Platform identity ────────────────────────────────────────────────────────

export type CRMPlatform = 'dynamics365' | 'salesforce' | 'hubspot' | 'zoho' | 'sugarcrm' | 'pega' | 'freshsales' | 'pipedrive' | 'custom'

export interface OrgConnection {
  id: string
  platform: CRMPlatform
  orgName: string
  orgUrl: string
  connectedAt: Date
  lastScannedAt?: Date
}

// ─── Raw payload — adapters produce this ─────────────────────────────────────
//
// Every metric is `Measured<T>`: the real value, or `null` when the adapter did
// not (or could not) measure it. Never send 0 or false as a stand-in for
// "unknown" — the scoring engine reads 0 as healthy, which produces a score
// the org has not earned. Unmeasured checks are skipped and reported as such.

export type Measured<T> = T | null

export interface RawHealthPayload {
  connection: OrgConnection

  schema: {
    totalEntities: Measured<number>
    customEntities: Measured<number>
    unusedEntities: Measured<number>
    totalFields: Measured<number>
    unusedFields: Measured<number>
    deprecatedObjects: Measured<number>
    namingViolations: Measured<number>
  }

  automation: {
    totalFlows: Measured<number>
    activeFlows: Measured<number>
    inactiveFlows: Measured<number>
    circularDependencies: Measured<number>
    maxNestingDepth: Measured<number>
    flowsWithoutErrorHandling: Measured<number>
    deprecatedApiCalls: Measured<number>
  }

  dataQuality: {
    totalRecordsSampled: Measured<number>
    duplicateCount: Measured<number>
    incompleteRequiredFields: Measured<number> // percentage 0-100
    staleRecords30d: Measured<number>
    staleRecords90d: Measured<number>
  }

  security: {
    totalUsers: Measured<number>
    adminUsers: Measured<number>
    dormantAdmins: Measured<number>          // admins with no login in 90d
    usersWithoutMFA: Measured<number>
    rolesWithExcessivePrivilege: Measured<number>
    auditLogEnabled: Measured<boolean>
  }

  adoption: {
    monthlyActiveUsers: Measured<number>
    totalLicensedUsers: Measured<number>
    featureUtilisationPct: Measured<number>  // 0-100
    automationsPerActiveUser: Measured<number>
    recentCustomisations30d: Measured<number>
  }
}

// ─── Scored payload — produced by the scoring engine ─────────────────────────

export interface DimensionScore {
  score: number | null  // 0–100, or null when none of the dimension's checks could be measured
  label: string
  issues: Issue[]
  checksMeasured: number
  checksTotal: number
  notMeasured: string[] // names of checks skipped because their inputs were not measured
}

export interface ScoredHealthPayload {
  connection: OrgConnection
  overallScore: number | null  // weighted over measured dimensions only; null if nothing was measured
  checksMeasured: number
  checksTotal: number
  raw: RawHealthPayload        // the measured values behind the score (null = not measured)
  trend?: number      // delta from last scan (positive = improving)
  dimensions: {
    schema: DimensionScore
    automation: DimensionScore
    dataQuality: DimensionScore
    security: DimensionScore
    adoption: DimensionScore
  }
  scannedAt: Date
}

// ─── Issues ───────────────────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Issue {
  id: string
  severity: IssueSeverity
  dimension: keyof ScoredHealthPayload['dimensions']
  title: string
  description: string
  affectedCount?: number
  remediationHint?: string
}

// ─── AI Diagnosis ─────────────────────────────────────────────────────────────

export interface AIRecommendation {
  rank: number
  title: string
  rationale: string
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  dimension: keyof ScoredHealthPayload['dimensions']
}

export interface AIDiagnosis {
  summary: string
  recommendations: AIRecommendation[]
  riskLevel: 'healthy' | 'watch' | 'attention' | 'critical'
  generatedAt: Date
}
