import type { ChannelSourceAdapter, CapturedEvent } from '../base.js';

export class GmailAdapter implements ChannelSourceAdapter {
  readonly source = 'gmail';

  async verify(req: Request): Promise<boolean> {
    // Google Pub/Sub sends a token query param set during subscription creation
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    return token === process.env.GMAIL_PUBSUB_TOKEN;
  }

  async parse(raw: unknown): Promise<CapturedEvent> {
    const body = raw as {
      message?: {
        data?: string;     // base64-encoded JSON with emailAddress + historyId
        messageId?: string;
      };
      subscription?: string;
    };

    const decoded = body.message?.data
      ? JSON.parse(Buffer.from(body.message.data, 'base64').toString('utf-8')) as {
          emailAddress?: string;
          historyId?: string;
        }
      : {};

    return {
      source: this.source,
      externalId: body.message?.messageId,
      contact: {
        email: decoded.emailAddress,
      },
      intent: 'inquiry',
      rawPayload: raw,
    };
  }

  // Construct raw content string from a Gmail message resource
  static buildRawContent(message: {
    subject?: string;
    from?: string;
    to?: string;
    date?: string;
    body?: string;
  }): string {
    const lines: string[] = [];
    if (message.from) lines.push(`From: ${message.from}`);
    if (message.to) lines.push(`To: ${message.to}`);
    if (message.subject) lines.push(`Subject: ${message.subject}`);
    if (message.date) lines.push(`Date: ${message.date}`);
    if (message.body) {
      lines.push('');
      lines.push(message.body);
    }
    return lines.join('\n');
  }
}
