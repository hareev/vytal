// Frontend-facing types for Channel Capture source adapters.
// Server implementations live in server/lib/channels/.

export type ChannelEventStatus = 'pending' | 'resolved' | 'duplicate' | 'failed'

export type CaptureIntent = 'lead' | 'inquiry' | 'support'

export interface ChannelEvent {
  id: string
  orgId: string
  source: string
  externalId?: string
  status: ChannelEventStatus
  rawPayload: Record<string, unknown>
  resolvedContactId?: string
  processedAt?: Date
  createdAt: Date
}

export interface CapturedEventContact {
  email?: string
  phone?: string
  name?: string
  metadata?: Record<string, unknown>
}
