import { Router } from 'express';
import { google } from 'googleapis';
import { eq, sql } from 'drizzle-orm';
import { db, users } from '@buildkit/shared';
import { signToken } from '../lib/jwt.js';
import { encrypt } from '../lib/encryption.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Redirect to Google OAuth
router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  });
  res.redirect(url);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email?.endsWith('@buildkitlabs.com')) {
      res.status(403).json({ error: 'Only @buildkitlabs.com accounts are allowed' });
      return;
    }

    // Upsert user
    const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    let user;

    const encryptedTokens = encrypt(JSON.stringify(tokens), process.env.ENCRYPTION_KEY!);

    if (existing.length > 0) {
      [user] = await db.update(users)
        .set({ googleTokens: encryptedTokens, avatarUrl: profile.picture })
        .where(eq(users.email, profile.email))
        .returning();
    } else {
      // First user gets admin role, subsequent users default to rep
      const userCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      const isFirstUser = userCount[0].count === 0;

      [user] = await db.insert(users).values({
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.picture,
        role: isFirstUser ? 'admin' : 'rep',
        googleTokens: encryptedTokens,
      }).returning();
    }

    const jwt = signToken({ userId: user.id, email: user.email, role: user.role });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwt}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
    role: users.role,
  }).from(users).where(eq(users.id, req.user!.userId)).limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// Logout (client-side token discard)
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

export default router;
