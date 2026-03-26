import { eq } from 'drizzle-orm';
import { db, users } from '@buildkit/shared';
import { decrypt, encrypt } from './encryption.js';
import type { GmailTokens } from '@buildkit/email';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/**
 * Decrypts and returns Gmail tokens for a user.
 * Throws if user has no tokens stored.
 */
export async function getGmailTokens(userId: string): Promise<GmailTokens> {
  const [user] = await db
    .select({ googleTokens: users.googleTokens })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.googleTokens) {
    throw new Error(`No Gmail tokens found for user ${userId}`);
  }

  const decrypted = decrypt(user.googleTokens as string, ENCRYPTION_KEY);
  return JSON.parse(decrypted) as GmailTokens;
}

/**
 * Updates stored Gmail tokens after a refresh.
 */
export async function updateGmailTokens(userId: string, tokens: GmailTokens): Promise<void> {
  const encrypted = encrypt(JSON.stringify(tokens), ENCRYPTION_KEY);
  await db
    .update(users)
    .set({ googleTokens: encrypted })
    .where(eq(users.id, userId));
}

/**
 * Creates a GmailProvider instance for a user, handling token refresh.
 */
export async function createGmailProvider(userId: string) {
  const { GmailProvider } = await import('@buildkit/email');
  const tokens = await getGmailTokens(userId);
  const provider = new GmailProvider(tokens, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

  // Refresh token if needed and persist
  const refreshed = await provider.refreshIfNeeded();
  if (refreshed) {
    await updateGmailTokens(userId, refreshed);
  }

  return provider;
}

export { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET };
