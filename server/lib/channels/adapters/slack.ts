import crypto from 'crypto';
import type { ChannelSourceAdapter, CapturedEvent } from '../base.js';

export class SlackAdapter implements ChannelSourceAdapter {
  readonly source = 'slack';

  async verify(req: Request): Promise<boolean> {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) return false;

    const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
    const slackSig = req.headers.get('x-slack-signature') ?? '';

    // Reject replays older than 5 minutes
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

    const body = await req.clone().text();
    const sigBase = `v0:${timestamp}:${body}`;
    const expected = 'v0=' + crypto
      .createHmac('sha256', signingSecret)
      .update(sigBase)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(slackSig));
  }

  async parse(raw: unknown): Promise<CapturedEvent> {
    const body = raw as {
      event?: {
        type?: string;
        user?: string;
        text?: string;
        ts?: string;
        channel?: string;
      };
      team_id?: string;
    };

    const event = body.event;

    return {
      source: this.source,
      externalId: event?.ts,
      contact: {},
      intent: 'support',
      rawPayload: raw,
    };
  }

  // Build a readable transcript from a Slack thread
  static buildRawContent(messages: Array<{
    user?: string;
    username?: string;
    text?: string;
    ts?: string;
  }>, channelName?: string): string {
    const header = channelName ? `#${channelName}\n\n` : '';
    const lines = messages.map((m) => {
      const time = m.ts ? new Date(parseFloat(m.ts) * 1000).toLocaleTimeString() : '';
      return `${m.username ?? m.user ?? 'Unknown'} [${time}]: ${m.text ?? ''}`;
    });
    return header + lines.join('\n');
  }
}
