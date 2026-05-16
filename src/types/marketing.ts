export type CampaignType = 'email' | 'sms' | 'push'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'

export interface CampaignStats {
  sent: number
  opened: number
  clicked: number
  bounced: number
}

export interface Campaign {
  id: string
  orgId: string
  name: string
  type: CampaignType
  status: CampaignStatus
  segmentId?: string
  subject?: string
  body?: string
  scheduledAt?: Date
  sentAt?: Date
  stats?: CampaignStats
  createdAt: Date
  updatedAt: Date
}

export interface SegmentFilter {
  field: string
  operator: 'is' | 'is_not' | 'contains' | 'gt' | 'lt'
  value: string | number
}

export interface Segment {
  id: string
  orgId: string
  name: string
  filters: SegmentFilter[]
  contactCount: number
  createdAt: Date
  updatedAt: Date
}

export type SequenceStepType = 'email' | 'wait' | 'condition'

export interface SequenceStep {
  id: string
  sequenceId: string
  position: number
  type: SequenceStepType
  delayHours?: number
  subject?: string
  body?: string
}

export interface Sequence {
  id: string
  orgId: string
  name: string
  status: 'active' | 'paused'
  triggerEvent: string
  steps: SequenceStep[]
  createdAt: Date
}
