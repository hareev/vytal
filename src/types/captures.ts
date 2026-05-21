export type ChannelType = 'email' | 'chat' | 'call_transcript' | 'document' | 'sms' | 'manual'

export type CaptureStatus = 'raw' | 'processing' | 'ready' | 'accepted' | 'dismissed'

export type CaptureIntent = 'sales' | 'support' | 'feedback' | 'general' | 'onboarding'

export type CaptureSentiment = 'positive' | 'neutral' | 'negative' | 'urgent'

export interface CaptureMetadata {
  // Email
  from?: string
  to?: string[]
  cc?: string[]
  subject?: string
  // Call
  duration?: number
  participants?: string[]
  // Document
  fileName?: string
  // General
  source?: string
  date?: string
}

export interface ExtractedContact {
  name: string
  email?: string
  company?: string
  role?: string
  existingContactId?: string  // set if matched against CRM
}

export interface ExtractedActionItem {
  description: string
  owner?: string
  dueHint?: string
  completed: boolean
}

export interface ExtractedDealSignal {
  mentionedValue?: string
  mentionedTimeline?: string
  stageSuggestion?: string
  existingDealId?: string  // set if matched against CRM
}

export interface CaptureExtraction {
  summary: string
  sentiment: CaptureSentiment
  intent: CaptureIntent
  topics: string[]
  contacts: ExtractedContact[]
  actionItems: ExtractedActionItem[]
  dealSignals: ExtractedDealSignal[]
  keyPoints: string[]
}

export interface ChannelCapture {
  id: string
  orgId: string
  channelType: ChannelType
  status: CaptureStatus
  rawContent: string
  metadata: CaptureMetadata
  extraction?: CaptureExtraction
  linkedContactIds: string[]
  linkedDealIds: string[]
  linkedActivityId?: string
  acceptedAt?: Date
  createdAt: Date
  updatedAt: Date
}
