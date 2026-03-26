import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Portal session helpers
const SESSION_PREFIX = 'portal:session:';
const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

export interface PortalSession {
  portalUserId: string;
  contactId: string;
  companyId: string;
  email: string;
}

export async function createSession(sessionId: string, data: PortalSession): Promise<void> {
  await redis.set(
    `${SESSION_PREFIX}${sessionId}`,
    JSON.stringify(data),
    'EX',
    SESSION_TTL
  );
}

export async function getSession(sessionId: string): Promise<PortalSession | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function destroySession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}

// Rate limiting for magic links
const RATE_PREFIX = 'portal:rate:magic:';
const RATE_LIMIT = 3;
const RATE_WINDOW = 60 * 60; // 1 hour in seconds

export async function checkMagicLinkRateLimit(email: string): Promise<boolean> {
  const key = `${RATE_PREFIX}${email.toLowerCase()}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_WINDOW);
  }
  return count <= RATE_LIMIT;
}
