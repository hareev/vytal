export type IntegrationProvider = 'gmail' | 'outlook' | 'slack' | 'teams'

export type IntegrationStatus = 'active' | 'error' | 'revoked' | 'configuring'

export interface Integration {
  id: string
  orgId: string
  provider: IntegrationProvider
  accountLabel: string | null
  status: IntegrationStatus
  lastSyncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
