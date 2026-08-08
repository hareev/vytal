import type { Contact } from '@/types/crm'

export interface AccountSummary {
  companySlug: string
  companyName: string
  contactCount: number
  dealCount: number
  openDealValue: number
  primaryStatus: Contact['status']
}

export interface AccountContact {
  id: string
  name: string
  email: string
  phone?: string
  title?: string
  role?: string
  status: Contact['status']
  tags: string[]
  lastActivityDaysAgo?: number
}

export interface AccountDeal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  status: string
  closeDate?: Date
}

export interface AccountSignal {
  source: 'capture' | 'deal' | 'ticket' | 'activity'
  type: string
  summary: string
  capturedAt: string
}

export interface AccountIntelligence {
  companyProfile: string
  industry?: string
  estimatedSize?: string
  productInterests: string[]
  toolsDetected: string[]
  keyContacts: { name: string; role: string }[]
  churnRisk: 'low' | 'medium' | 'high'
  expansionSignal: number
  recommendedActions: string[]
  intelligenceSummary: string
  generatedAt: Date
}

export interface AccountProfile {
  companySlug: string
  companyName: string
  contacts: AccountContact[]
  deals: AccountDeal[]
  signals: AccountSignal[]
  intelligence?: AccountIntelligence
}
