import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import dealRoutes from './routes/deals.js';
import pipelineRoutes from './routes/pipelines.js';
import ticketRoutes from './routes/tickets.js';
import campaignRoutes from './routes/campaigns.js';
import segmentRoutes from './routes/segments.js';
import orgRoutes from './routes/orgs.js';

const app = new Hono();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.route('/api/auth', authRoutes);
app.route('/api/contacts', contactRoutes);
app.route('/api/deals', dealRoutes);
app.route('/api/pipelines', pipelineRoutes);
app.route('/api/tickets', ticketRoutes);
app.route('/api/campaigns', campaignRoutes);
app.route('/api/segments', segmentRoutes);
app.route('/api/orgs', orgRoutes);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (c) => c.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message ?? 'Internal server error' }, 500);
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ---------------------------------------------------------------------------
// Start server (only when run directly, not imported for tests)
// ---------------------------------------------------------------------------
const port = parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Vytal API server listening on http://localhost:${info.port}`);
});

export { app };
