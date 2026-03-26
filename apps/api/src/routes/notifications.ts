import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, notifications, notificationPreferences } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET / — List user's notifications
router.get('/', async (req, res) => {
  const userId = req.user!.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.isRead, false));
  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

// PATCH /read-all — Mark all unread as read (must come before /:id/read)
router.patch('/read-all', async (req, res) => {
  const userId = req.user!.userId;
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  res.json({ success: true });
});

// GET /unread-count
router.get('/unread-count', async (req, res) => {
  const userId = req.user!.userId;
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  res.json({ count: result.count });
});

// GET /preferences — Get or create defaults
router.get('/preferences', async (req, res) => {
  const userId = req.user!.userId;
  let [prefs] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  if (!prefs) {
    [prefs] = await db.insert(notificationPreferences).values({ userId }).returning();
  }
  res.json(prefs);
});

// PUT /preferences — Update preferences
router.put('/preferences', async (req, res) => {
  const userId = req.user!.userId;
  const { staleDealDays, hotLeadOpens, hotLeadWindowHours, dailyDigestEnabled, digestSendHour } = req.body;

  const [existing] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);

  if (existing) {
    const [updated] = await db.update(notificationPreferences)
      .set({ staleDealDays, hotLeadOpens, hotLeadWindowHours, dailyDigestEnabled, digestSendHour })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(notificationPreferences)
      .values({ userId, staleDealDays, hotLeadOpens, hotLeadWindowHours, dailyDigestEnabled, digestSendHour })
      .returning();
    res.json(created);
  }
});

// GET /stream — SSE endpoint for real-time notifications
router.get('/stream', async (req, res) => {
  const userId = req.user!.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendNotifications = async () => {
    try {
      const unread = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
        .orderBy(desc(notifications.createdAt))
        .limit(10);

      if (unread.length > 0) {
        res.write(`data: ${JSON.stringify(unread)}\n\n`);
      }
    } catch (err) {
      console.error('[notifications/stream] poll error:', err);
    }
  };

  await sendNotifications();
  const interval = setInterval(sendNotifications, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// PATCH /:id/read — Mark single notification as read
router.patch('/:id/read', async (req, res) => {
  const userId = req.user!.userId;
  const id = req.params.id;

  const [updated] = await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json(updated);
});

export default router;
