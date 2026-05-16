import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';

export type AuthPayload = {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
};

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.orgId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }

    c.set('auth', {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role as AuthPayload['role'],
    });

    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});
