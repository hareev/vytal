import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { processCapture } from '../lib/captureProcessor.js';
import { GmailAdapter } from '../lib/channels/adapters/gmail.js';
import { OutlookAdapter } from '../lib/channels/adapters/outlook.js';
import { SlackAdapter } from '../lib/channels/adapters/slack.js';
import { TeamsAdapter } from '../lib/channels/adapters/teams.js';

const router = new Hono();

// ---------------------------------------------------------------------------
// OAuth config per provider
// ---------------------------------------------------------------------------

const OAUTH_CONFIG = {
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    clientId: () => process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: () => process.env.GMAIL_CLIENT_SECRET ?? '',
    redirectUri: () => process.env.GMAIL_REDIRECT_URI ?? '',
  },
  outlook: {
    authUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/token`,
    scope: 'https://graph.microsoft.com/Mail.Read offline_access',
    clientId: () => process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET ?? '',
    redirectUri: () => process.env.MICROSOFT_REDIRECT_URI ?? '',
  },
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scope: 'channels:history,im:history,channels:read,users:read',
    clientId: () => process.env.SLACK_CLIENT_ID ?? '',
    clientSecret: () => process.env.SLACK_CLIENT_SECRET ?? '',
    redirectUri: () => process.env.SLACK_REDIRECT_URI ?? '',
  },
  teams: {
    authUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? 'common'}/oauth2/v2.0/token`,
    scope: 'https://graph.microsoft.com/ChannelMessage.Read.All https://graph.microsoft.com/Chat.Read offline_access',
    clientId: () => process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET ?? '',
    redirectUri: () => process.env.MICROSOFT_REDIRECT_URI ?? '',
  },
} as const;

type Provider = keyof typeof OAUTH_CONFIG;

// ---------------------------------------------------------------------------
// Helper: resolve OAuth credentials — env vars first, then DB config
// ---------------------------------------------------------------------------

interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function resolveCredentials(provider: Provider, orgId: string): Promise<ProviderCredentials | null> {
  const cfg = OAUTH_CONFIG[provider];
  const clientId = cfg.clientId();
  if (clientId) {
    return { clientId, clientSecret: cfg.clientSecret(), redirectUri: cfg.redirectUri() };
  }
  const [row] = await db
    .select({ config: schema.integrations.config })
    .from(schema.integrations)
    .where(and(
      eq(schema.integrations.org_id, orgId),
      eq(schema.integrations.provider, provider),
    ))
    .limit(1);
  if (!row?.config) return null;
  const c = row.config as { client_id?: string; client_secret?: string; redirect_uri?: string };
  if (!c.client_id || !c.client_secret || !c.redirect_uri) return null;
  return { clientId: c.client_id, clientSecret: c.client_secret, redirectUri: c.redirect_uri };
}

// ---------------------------------------------------------------------------
// Helper: exchange code for tokens
// ---------------------------------------------------------------------------

async function exchangeCode(
  provider: Provider,
  code: string,
  credentials: ProviderCredentials,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string }> {
  const cfg = OAUTH_CONFIG[provider];
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: credentials.redirectUri,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${provider}): ${text}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    authed_user?: { access_token: string };
  };

  // Slack returns the bot token at top level; user token under authed_user
  const accessToken = provider === 'slack'
    ? (data.authed_user?.access_token ?? data.access_token)
    : data.access_token;

  return {
    accessToken,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

// ---------------------------------------------------------------------------
// Helper: fetch account label (display name / email) after connecting
// ---------------------------------------------------------------------------

async function fetchAccountLabel(provider: Provider, accessToken: string): Promise<string> {
  try {
    if (provider === 'gmail') {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as { email?: string };
      return data.email ?? 'Gmail account';
    }
    if (provider === 'outlook' || provider === 'teams') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as { displayName?: string; mail?: string };
      return data.mail ?? data.displayName ?? 'Microsoft account';
    }
    if (provider === 'slack') {
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as { team?: string; user?: string };
      return data.team ? `${data.team} / ${data.user ?? ''}` : 'Slack workspace';
    }
  } catch {
    // Non-critical — label is cosmetic
  }
  return provider;
}

// ---------------------------------------------------------------------------
// Authenticated management routes
// ---------------------------------------------------------------------------

router.use('/integrations', authMiddleware);
router.use('/integrations/*', authMiddleware);

// GET /integrations — list connected integrations
router.get('/integrations', async (c) => {
  const auth = c.get('auth');
  const rows = await db
    .select({
      id: schema.integrations.id,
      provider: schema.integrations.provider,
      accountLabel: schema.integrations.account_label,
      status: schema.integrations.status,
      lastSyncedAt: schema.integrations.last_synced_at,
      createdAt: schema.integrations.created_at,
    })
    .from(schema.integrations)
    .where(eq(schema.integrations.org_id, auth.orgId));

  return c.json(rows);
});

// POST /integrations/:provider/configure — save OAuth app credentials to DB
router.post('/integrations/:provider/configure', async (c) => {
  const auth = c.get('auth');
  const provider = c.req.param('provider') as Provider;

  if (!(provider in OAUTH_CONFIG)) {
    return c.json({ error: 'Unknown provider' }, 400);
  }

  const body = await c.req.json().catch(() => ({})) as {
    clientId?: string; clientSecret?: string; redirectUri?: string;
  };
  if (!body.clientId || !body.clientSecret || !body.redirectUri) {
    return c.json({ error: 'clientId, clientSecret, redirectUri are required' }, 400);
  }

  const config = { client_id: body.clientId, client_secret: body.clientSecret, redirect_uri: body.redirectUri };

  const existing = await db
    .select({ id: schema.integrations.id, status: schema.integrations.status })
    .from(schema.integrations)
    .where(and(
      eq(schema.integrations.org_id, auth.orgId),
      eq(schema.integrations.provider, provider),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.integrations)
      .set({ config, updated_at: new Date() })
      .where(eq(schema.integrations.id, existing[0].id));
    if (existing[0].status !== 'active') {
      await db
        .update(schema.integrations)
        .set({ status: 'configuring' as 'active', updated_at: new Date() })
        .where(eq(schema.integrations.id, existing[0].id));
    }
  } else {
    await db.insert(schema.integrations).values({
      org_id: auth.orgId,
      provider,
      access_token: '',
      config,
      status: 'configuring' as 'active',
    });
  }

  return c.json({ ok: true });
});

// GET /integrations/:provider/connect — redirect to OAuth consent
router.get('/integrations/:provider/connect', async (c) => {
  const auth = c.get('auth');
  const provider = c.req.param('provider') as Provider;

  if (!(provider in OAUTH_CONFIG)) {
    return c.json({ error: 'Unknown provider' }, 400);
  }

  const credentials = await resolveCredentials(provider, auth.orgId);
  if (!credentials) {
    return c.redirect(`/app/integrations/${provider}/setup`);
  }

  const cfg = OAUTH_CONFIG[provider];
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state: auth.orgId,
    access_type: 'offline',
    prompt: 'consent',
  });

  return c.redirect(`${cfg.authUrl}?${params.toString()}`);
});

// GET /integrations/:provider/callback — exchange code, store, redirect
router.get('/integrations/:provider/callback', async (c) => {
  const provider = c.req.param('provider') as Provider;
  const { code, state: orgId, error } = c.req.query();

  if (error || !code || !orgId) {
    return c.redirect('/app/integrations?error=oauth_denied');
  }

  try {
    const credentials = await resolveCredentials(provider, orgId);
    if (!credentials) {
      return c.redirect('/app/integrations?error=not_configured');
    }
    const tokens = await exchangeCode(provider, code, credentials);
    const accountLabel = await fetchAccountLabel(provider, tokens.accessToken);

    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    // Upsert — replace any existing integration for this org + provider
    const existing = await db
      .select({ id: schema.integrations.id })
      .from(schema.integrations)
      .where(and(
        eq(schema.integrations.org_id, orgId),
        eq(schema.integrations.provider, provider),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.integrations)
        .set({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken ?? null,
          token_expires_at: expiresAt,
          scope: tokens.scope ?? null,
          account_label: accountLabel,
          status: 'active',
          updated_at: new Date(),
        })
        .where(eq(schema.integrations.id, existing[0].id));
    } else {
      await db.insert(schema.integrations).values({
        org_id: orgId,
        provider,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken ?? null,
        token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
        account_label: accountLabel,
        status: 'active',
      });
    }
  } catch (err) {
    console.error(`Integration callback error (${provider}):`, err);
    return c.redirect('/app/integrations?error=callback_failed');
  }

  return c.redirect('/app/integrations?connected=' + provider);
});

// DELETE /integrations/:provider — disconnect
router.delete('/integrations/:provider', async (c) => {
  const auth = c.get('auth');
  const provider = c.req.param('provider') as Provider;

  await db
    .delete(schema.integrations)
    .where(and(
      eq(schema.integrations.org_id, auth.orgId),
      eq(schema.integrations.provider, provider),
    ));

  return c.json({ ok: true });
});

// POST /integrations/:provider/sync — manual pull (placeholder)
router.post('/integrations/:provider/sync', async (c) => {
  const auth = c.get('auth');
  const provider = c.req.param('provider') as Provider;

  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(and(
      eq(schema.integrations.org_id, auth.orgId),
      eq(schema.integrations.provider, provider),
    ))
    .limit(1);

  if (!integration) {
    return c.json({ error: 'Integration not connected' }, 404);
  }

  await db
    .update(schema.integrations)
    .set({ last_synced_at: new Date(), updated_at: new Date() })
    .where(eq(schema.integrations.id, integration.id));

  return c.json({ ok: true, synced: new Date() });
});

// ---------------------------------------------------------------------------
// Webhook handlers (no auth middleware — verified by signature)
// ---------------------------------------------------------------------------

// Helper: create a channel capture from a parsed provider message
async function createCaptureFromWebhook(
  orgId: string,
  channelType: 'email' | 'chat',
  rawContent: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const [capture] = await db
    .insert(schema.channel_captures)
    .values({
      org_id: orgId,
      channel_type: channelType,
      status: 'raw',
      raw_content: rawContent,
      metadata,
    })
    .returning();

  if (process.env.ANTHROPIC_API_KEY) {
    processCapture(
      capture.raw_content,
      capture.channel_type,
      capture.metadata as Parameters<typeof processCapture>[2],
      [],
      [],
    )
      .then(async (extraction) => {
        await db
          .update(schema.channel_captures)
          .set({
            status: 'ready',
            extraction: extraction as unknown as Record<string, unknown>,
            updated_at: new Date(),
          })
          .where(eq(schema.channel_captures.id, capture.id));
      })
      .catch((err) => console.error('Webhook capture processing failed:', err));
  }
}

// POST /integrations/webhook/gmail
router.post('/integrations/webhook/gmail', async (c) => {
  const adapter = new GmailAdapter();
  const valid = await adapter.verify(c.req.raw);
  if (!valid) return c.json({ error: 'Unauthorized' }, 401);

  // Google Pub/Sub — we receive a notification that a new message exists.
  // A full implementation would then call the Gmail API to fetch the message.
  // Here we acknowledge the push and return early; a /sync call fetches messages.
  return c.json({ ok: true });
});

// POST /integrations/webhook/outlook
router.post('/integrations/webhook/outlook', async (c) => {
  // Microsoft Graph subscription validation: echo validationToken
  const validationToken = c.req.query('validationToken');
  if (validationToken) {
    return c.text(validationToken, 200, { 'Content-Type': 'text/plain' });
  }

  const body = await c.req.json().catch(() => ({}));
  const adapter = new OutlookAdapter();
  await adapter.parse(body);

  return c.json({ ok: true });
});

// POST /integrations/webhook/slack
router.post('/integrations/webhook/slack', async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    type?: string;
    challenge?: string;
    event?: { type?: string; text?: string; user?: string; channel?: string; ts?: string };
    team_id?: string;
  };

  // URL verification challenge
  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge });
  }

  const adapter = new SlackAdapter();
  const valid = await adapter.verify(c.req.raw);
  if (!valid) return c.json({ error: 'Unauthorized' }, 401);

  // Only handle message events with content
  if (body.event?.type === 'message' && body.event.text && body.team_id) {
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(and(
        eq(schema.integrations.provider, 'slack'),
        eq(schema.integrations.status, 'active'),
      ))
      .limit(1);

    if (integration) {
      const rawContent = SlackAdapter.buildRawContent([{
        text: body.event.text,
        user: body.event.user,
        ts: body.event.ts,
      }], body.event.channel);

      await createCaptureFromWebhook(integration.org_id, 'chat', rawContent, {
        source: 'Slack',
        participants: [body.event.user ?? 'unknown'],
      });
    }
  }

  return c.json({ ok: true });
});

// POST /integrations/webhook/teams
router.post('/integrations/webhook/teams', async (c) => {
  const validationToken = c.req.query('validationToken');
  if (validationToken) {
    return c.text(validationToken, 200, { 'Content-Type': 'text/plain' });
  }

  return c.json({ ok: true });
});

export { router as integrationRoutes };
