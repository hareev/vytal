import { serve } from '@hono/node-server';
import { app } from './app.js';
import { startSequenceScheduler } from './lib/sequenceScheduler.js';

const port = parseInt(process.env.PORT ?? '3001', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Vytal API server listening on http://localhost:${info.port}`);
  startSequenceScheduler();
});

export { app };
