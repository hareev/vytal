import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export type WebhookEventName =
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
  | 'sequence.completed';

export interface WebhookPayload {
  event: WebhookEventName;
  orgId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function dispatchWebhook(
  orgId: string,
  event: WebhookEventName,
  data: Record<string, unknown>,
): Promise<void> {
  // Query all active webhooks for this org
  const activeWebhooks = await db
    .select()
    .from(schema.webhooks)
    .where(and(eq(schema.webhooks.org_id, orgId), eq(schema.webhooks.active, true)));

  // Filter to those that subscribe to this event
  const matchingWebhooks = activeWebhooks.filter((wh) =>
    (wh.events as string[]).includes(event),
  );

  if (matchingWebhooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    orgId,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  const deliveries = matchingWebhooks.map(async (webhook) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const hmac = crypto.createHmac('sha256', webhook.secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vytal-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      console.error(`[webhookDispatcher] Failed to deliver ${event} to ${webhook.url}:`, err);
    } finally {
      clearTimeout(timeoutId);
    }
  });

  await Promise.allSettled(deliveries);
}
