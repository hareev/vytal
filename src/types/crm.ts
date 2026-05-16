export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'churned'

export interface Contact {
  id: string
  orgId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  status: ContactStatus
  tags?: string[]
  notes?: string
  ownerId?: string
  createdAt: Date
  updatedAt: Date
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note'

export interface Activity {
  id: string
  orgId: string
  type: ActivityType
  subject: string
  description?: string
  contactId?: string
  dealId?: string
  userId: string
  dueAt?: Date
  completedAt?: Date
  createdAt: Date
}

export type DealStatus = 'open' | 'won' | 'lost'

export interface Deal {
  id: string
  orgId: string
  title: string
  value: number
  currency: string
  stageId: string
  pipelineId: string
  contactId?: string
  ownerId?: string
  closeDate?: Date
  status: DealStatus
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface Stage {
  id: string
  pipelineId: string
  name: string
  position: number
  probability: number
  deals?: Deal[]
}

export interface Pipeline {
  id: string
  orgId: string
  name: string
  isDefault: boolean
  stages: Stage[]
  createdAt: Date
}
