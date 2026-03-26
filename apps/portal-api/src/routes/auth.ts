import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db, portalUsers } from '@buildkit/shared';
import { generateMagicToken, getTokenExpiry, sendMagicLinkEmail } from '../lib/magicLink.js';
import { createSession } from '../lib/redis.js';
import { magicLinkRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Request magic link
router.post('/request-link', magicLinkRateLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // Find portal user by email
  const [portalUser] = await db.select()
    .from(portalUsers)
    .where(eq(portalUsers.email, email.toLowerCase().trim()))
    .limit(1);

  if (!portalUser) {
    // Don't reveal whether the email exists — always return success
    res.json({ success: true, message: 'If an account exists, a login link has been sent.' });
    return;
  }

  // Generate token and save to DB
  const token = generateMagicToken();
  const expiresAt = getTokenExpiry();

  await db.update(portalUsers)
    .set({
      magicLinkToken: token,
      tokenExpiresAt: expiresAt,
    })
    .where(eq(portalUsers.id, portalUser.id));

  // Send email (fire and forget — don't block response)
  sendMagicLinkEmail(email, token).catch(err => {
    console.error('Failed to send magic link email:', err);
  });

  res.json({ success: true, message: 'If an account exists, a login link has been sent.' });
});

// Verify magic link token
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;

  const [portalUser] = await db.select()
    .from(portalUsers)
    .where(
      and(
        eq(portalUsers.magicLinkToken, token),
        gt(portalUsers.tokenExpiresAt, new Date())
      )
    )
    .limit(1);

  if (!portalUser) {
    const frontendUrl = process.env.PORTAL_FRONTEND_URL || 'http://localhost:5174';
    res.redirect(`${frontendUrl}/login?error=invalid_or_expired`);
    return;
  }

  // Clear token (single use)
  await db.update(portalUsers)
    .set({
      magicLinkToken: null,
      tokenExpiresAt: null,
      lastLoginAt: new Date(),
    })
    .where(eq(portalUsers.id, portalUser.id));

  // Create Redis session
  const sessionId = crypto.randomBytes(32).toString('hex');
  await createSession(sessionId, {
    portalUserId: portalUser.id,
    contactId: portalUser.contactId,
    companyId: portalUser.companyId,
    email: portalUser.email,
  });

  // Redirect to portal frontend with session token in hash (not query string) to avoid server logs
  const frontendUrl = process.env.PORTAL_FRONTEND_URL || 'http://localhost:5174';
  res.redirect(`${frontendUrl}/#session=${sessionId}`);
});

export default router;
