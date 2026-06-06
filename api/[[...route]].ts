import { handle } from 'hono/vercel';
import { app } from '../server/app';

export const config = { runtime: 'nodejs20.x' };

export default handle(app);
