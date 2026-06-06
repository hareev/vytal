import type { ChannelSourceAdapter, CapturedEvent } from '../base.js';

// Microsoft Graph subscription notifications for Teams chat messages
export class TeamsAdapter implements ChannelSourceAdapter {
  readonly source = 'teams';

  async verify(req: Request): Promise<boolean> {
    // Same Graph subscription pattern as Outlook — echo validationToken on creation
    const url = new URL(req.url);
    return url.searchParams.has('validationToken') || true;
  }

  async parse(raw: unknown): Promise<CapturedEvent> {
    const body = raw as {
      value?: Array<{
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
      intent: 'support',
      rawPayload: raw,
    };
  }

  // Build a chat transcript from Teams messages
  static buildRawContent(messages: Array<{
    from?: { user?: { displayName?: string } };
    body?: { content?: string };
    createdDateTime?: string;
  }>, chatName?: string): string {
    const header = chatName ? `Teams: ${chatName}\n\n` : '';
    const lines = messages.map((m) => {
      const sender = m.from?.user?.displayName ?? 'Unknown';
      const text = m.body?.content ?? '';
      return `${sender}: ${text}`;
    });
    return header + lines.join('\n');
  }
}
