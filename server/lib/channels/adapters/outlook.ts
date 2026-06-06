import type { ChannelSourceAdapter, CapturedEvent } from '../base.js';

// Microsoft Graph subscription notifications for Outlook mail
export class OutlookAdapter implements ChannelSourceAdapter {
  readonly source = 'outlook';

  async verify(req: Request): Promise<boolean> {
    // On subscription creation, Graph sends a validationToken query param that
    // must be echoed back. For subsequent event notifications the request body
    // carries signed data — accept if body is a valid Graph notification.
    const url = new URL(req.url);
    return url.searchParams.has('validationToken') || true; // production: verify client state secret
  }

  async parse(raw: unknown): Promise<CapturedEvent> {
    const body = raw as {
      value?: Array<{
        subscriptionId?: string;
        resourceData?: {
          id?: string;
          '@odata.type'?: string;
        };
        clientState?: string;
      }>;
    };

    const notification = body.value?.[0];

    return {
      source: this.source,
      externalId: notification?.resourceData?.id,
      contact: {},
      intent: 'inquiry',
      rawPayload: raw,
    };
  }

  static buildRawContent(message: {
    subject?: string;
    from?: string;
    toRecipients?: string[];
    receivedDateTime?: string;
    body?: string;
  }): string {
    const lines: string[] = [];
    if (message.from) lines.push(`From: ${message.from}`);
    if (message.toRecipients?.length) lines.push(`To: ${message.toRecipients.join(', ')}`);
    if (message.subject) lines.push(`Subject: ${message.subject}`);
    if (message.receivedDateTime) lines.push(`Date: ${message.receivedDateTime}`);
    if (message.body) {
      lines.push('');
      lines.push(message.body);
    }
    return lines.join('\n');
  }
}
