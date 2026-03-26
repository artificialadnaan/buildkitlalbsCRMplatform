import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, emailEvents, emailSends } from '@buildkit/shared';

const router = Router();

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// GET /t/:emailSendId/open.png — tracking pixel (NO auth)
router.get('/:emailSendId/open.png', async (req, res) => {
  const { emailSendId } = req.params;

  try {
    // Verify the emailSendId exists
    const [send] = await db.select({ id: emailSends.id })
      .from(emailSends)
      .where(eq(emailSends.id, emailSendId))
      .limit(1);

    if (send) {
      await db.insert(emailEvents).values({
        emailSendId,
        type: 'open',
        metadata: req.headers['user-agent'] || null,
      });
    }
  } catch (err) {
    // Log but don't fail — always return the pixel
    console.error('[email-tracking] Failed to log open event:', err);
  }

  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(PIXEL);
});

// GET /t/:emailSendId/click?url=<encoded-url> — click redirect (NO auth)
router.get('/:emailSendId/click', async (req, res) => {
  const { emailSendId } = req.params;
  const url = req.query.url as string | undefined;

  if (!url) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Validate redirect URL — must be http/https and not an internal auth endpoint
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).send('Invalid url parameter');
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    res.status(400).send('Invalid url protocol');
    return;
  }

  const ownHost = req.get('host') ?? '';
  if (parsedUrl.host === ownHost && parsedUrl.pathname.startsWith('/auth')) {
    res.status(400).send('Redirect to auth endpoints is not allowed');
    return;
  }

  try {
    const [send] = await db.select({ id: emailSends.id })
      .from(emailSends)
      .where(eq(emailSends.id, emailSendId))
      .limit(1);

    if (send) {
      await db.insert(emailEvents).values({
        emailSendId,
        type: 'click',
        metadata: url,
      });
    }
  } catch (err) {
    console.error('[email-tracking] Failed to log click event:', err);
  }

  res.redirect(302, parsedUrl.toString());
});

export default router;
