import type { Request, Response, NextFunction } from 'express';
import { checkMagicLinkRateLimit } from '../lib/redis.js';

export function magicLinkRateLimiter(req: Request, res: Response, next: NextFunction) {
  const email = req.body?.email;
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  checkMagicLinkRateLimit(email)
    .then(allowed => {
      if (!allowed) {
        res.status(429).json({ error: 'Too many magic link requests. Try again in an hour.' });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Rate limit check failed' });
    });
}
