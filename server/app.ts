import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import contactRoutes from './routes/contacts.js';
import dealRoutes from './routes/deals.js';
import pipelineRoutes from './routes/pipelines.js';
import ticketRoutes from './routes/tickets.js';
import campaignRoutes from './routes/campaigns.js';
import segmentRoutes from './routes/segments.js';
import orgRoutes from './routes/orgs.js';
import kbRoutes from './routes/kb.js';
import { webhookRoutes } from './routes/webhooks.js';
import { sequenceRoutes } from './routes/sequences.js';
import { captureRoutes } from './routes/captures.js';
import { ingestRoutes } from './routes/ingest.js';
import { integrationRoutes } from './routes/integrations.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.route('/api/auth', authRoutes);
app.route('/api/health', healthRoutes);
app.route('/api/contacts', contactRoutes);
app.route('/api/deals', dealRoutes);
app.route('/api/pipelines', pipelineRoutes);
app.route('/api/tickets', ticketRoutes);
app.route('/api/campaigns', campaignRoutes);
app.route('/api/segments', segmentRoutes);
app.route('/api/orgs', orgRoutes);
app.route('/api/kb', kbRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/sequences', sequenceRoutes);
app.route('/api/captures', captureRoutes);
app.route('/api/ingest', ingestRoutes);
app.route('/api', integrationRoutes);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export { app };
