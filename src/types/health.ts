// ─── Platform identity ────────────────────────────────────────────────────────

export type CRMPlatform = 'dynamics365' | 'salesforce' | 'siebel' | 'hubspot' | 'custom'

export interface OrgConnection {
  id: string
  platform: CRMPlatform
  orgName: string
  orgUrl: string
  connectedAt: Date
  lastScannedAt?: Date
}

// ─── Raw payload — adapters produce this ─────────────────────────────────────

export interface RawHealthPayload {
  connection: OrgConnection

  schema: {
    totalEntities: number
    customEntities: number
    unusedEntities: number
    totalFields: number
    unusedFields: number
    deprecatedObjects: number
    namingViolations: number
  }

  automation: {
    totalFlows: number
    activeFlows: number
    inactiveFlows: number
    circularDependencies: number
    maxNestingDepth: number
    flowsWithoutErrorHandling: number
    deprecatedApiCalls: number
  }

  dataQuality: {
    totalRecordsSampled: number
    duplicateCount: number
    incompleteRequiredFields: number // percentage 0-100
    staleRecords30d: number
    staleRecords90d: number
  }

  security: {
    totalUsers: number
    adminUsers: number
    dormantAdmins: number          // admins with no login in 90d
    usersWithoutMFA: number
    rolesWithExcessivePrivilege: number
    auditLogEnabled: boolean
  }

  adoption: {
    monthlyActiveUsers: number
    totalLicensedUsers: number
    featureUtilisationPct: number  // 0-100
    automationsPerActiveUser: number
    recentCustomisations30d: number
  }
}

// ─── Scored payload — produced by the scoring engine ─────────────────────────

export interface DimensionScore {
  score: number       // 0–100
  label: string
  issues: Issue[]
}

export interface ScoredHealthPayload {
  connection: OrgConnection
  overallScore: number
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
