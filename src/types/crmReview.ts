export type CrmSubmissionStatus = 'pending' | 'analyzing' | 'completed' | 'failed'
export type CrmVerdict = 'looks_good' | 'needs_improvement' | 'not_a_crm'

export interface CrmFeaturesDetected {
  contactManagement: boolean
  dealPipeline: boolean
  activityTracking: boolean
  userAuth: boolean
  search: boolean
  reporting: boolean
  emailIntegration: boolean
  tags: boolean
}

export interface CrmAiReport {
  verdict: CrmVerdict
  score: number
  summary: string
  techStack: string[]
  featuresDetected: CrmFeaturesDetected
  strengths: string[]
  gaps: string[]
  recommendations: string[]
  useCaseFit: string
}

export interface CrmSubmission {
  id: string
  user_id: string | null
  org_id: string | null
  submitter_name: string | null
  crm_name: string
  repo_url: string | null
  app_url: string | null
  description: string
  built_for: string | null
  status: CrmSubmissionStatus
  verdict: CrmVerdict | null
  score: number | null
  ai_report: CrmAiReport | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface CreateCrmSubmissionInput {
  crmName: string
  repoUrl?: string
  appUrl?: string
  description: string
  builtFor?: string
}
