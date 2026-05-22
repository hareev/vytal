// ─── Shared event shape produced by every source adapter ─────────────────────

export interface CapturedEvent {
  source: string
  externalId?: string
  contact: {
    email?: string
    phone?: string
    name?: string
    metadata?: Record<string, unknown>
  }
  intent?: 'lead' | 'inquiry' | 'support'
  rawPayload: unknown
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface ChannelSourceAdapter {
  readonly source: string
  verify(req: Request): Promise<boolean>
  parse(raw: unknown): Promise<CapturedEvent>
}
