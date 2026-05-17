export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TicketMessage {
  id: string
  ticketId: string
  body: string
  authorId?: string
  isInternal: boolean
  createdAt: Date
}

export interface Ticket {
  id: string
  orgId: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  contactId?: string
  assigneeId?: string
  tags?: string[]
  slaDueAt?: Date
  resolvedAt?: Date
  messages?: TicketMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface SLAPolicy {
  urgent: 8
  high: 24
  medium: 72
  low: 168
}

export const DEFAULT_SLA_POLICY: SLAPolicy = {
  urgent: 8,
  high: 24,
  medium: 72,
  low: 168,
}
