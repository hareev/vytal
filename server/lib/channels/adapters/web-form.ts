import type { ChannelSourceAdapter, CapturedEvent } from '../base.js'

interface WebFormBody {
  name?: string
  email?: string
  phone?: string
  message?: string
  metadata?: Record<string, unknown>
}

export class WebFormAdapter implements ChannelSourceAdapter {
  readonly source = 'web-form'

  async verify(_req: Request): Promise<boolean> {
    return true
  }

  async parse(raw: unknown): Promise<CapturedEvent> {
    const body = raw as WebFormBody

    if (!body.email && !body.phone) {
      throw new Error('web-form payload must include at least email or phone')
    }

    let firstName: string | undefined
    let lastName: string | undefined

    if (body.name) {
      const parts = body.name.trim().split(/\s+/)
      firstName = parts[0]
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    }

    return {
      source: this.source,
      contact: {
        email: body.email,
        phone: body.phone,
        name: body.name,
        metadata: {
          firstName,
          lastName,
          message: body.message,
          ...body.metadata,
        },
      },
      intent: 'lead',
      rawPayload: raw,
    }
  }
}
