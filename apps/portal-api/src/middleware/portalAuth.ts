import type { Request, Response, NextFunction } from 'express';
import { getSession, type PortalSession } from '../lib/redis.js';

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalSession;
    }
  }
}

export function portalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-portal-session'] as string | undefined;

  if (!sessionId) {
    res.status(401).json({ error: 'Missing session token' });
    return;
  }

  getSession(sessionId)
    .then(session => {
      if (!session) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }
      req.portalUser = session;
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Session verification failed' });
    });
}
