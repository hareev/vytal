export type ArticleStatus = 'draft' | 'published'

export interface KbCategory {
  id: string
  orgId: string
  name: string
  slug: string
  description?: string
  position: number
  articleCount?: number
  createdAt: Date
}

export interface KbArticle {
  id: string
  orgId: string
  categoryId?: string
  title: string
  slug: string
  body: string
  status: ArticleStatus
  authorId?: string
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

export interface Webhook {
  id: string
  orgId: string
  url: string
  events: WebhookEvent[]
  secret: string
  active: boolean
  description?: string
  createdAt: Date
}

export type WebhookEvent =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.won'
  | 'deal.lost'
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.resolved'
  | 'campaign.sent'
  | 'sequence.enrolled'
  | 'sequence.completed'
