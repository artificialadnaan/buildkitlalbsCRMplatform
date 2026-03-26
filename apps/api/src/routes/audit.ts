import { Router } from 'express';
import { desc, eq, and, sql, gte, lte, inArray } from 'drizzle-orm';
import { db, auditLog, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const SCRAPE_ACTIONS = ['scrape_started', 'scrape_completed'] as const;

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { entity, entityId, userId, from, to, action } = req.query;
  const limit = parseInt(req.query.limit as string) || 100;
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * limit;

  const isAdmin = req.user!.role === 'admin';

  const conditions = [];

  // Reps can only see scrape-related entries
  if (!isAdmin) {
    conditions.push(inArray(auditLog.action, [...SCRAPE_ACTIONS]));
  } else {
    // Admin: allow optional action filter
    if (action) conditions.push(eq(auditLog.action, action as string));
  }

  if (entity) conditions.push(eq(auditLog.entity, entity as string));
  if (entityId) conditions.push(eq(auditLog.entityId, entityId as string));
  if (userId && isAdmin) conditions.push(eq(auditLog.userId, userId as string));
  if (from) conditions.push(gte(auditLog.createdAt, new Date(from as string)));
  if (to) conditions.push(lte(auditLog.createdAt, new Date(to as string)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        userName: users.name,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        changes: isAdmin ? auditLog.changes : sql<null>`NULL`,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where),
  ]);

  res.json({ data, total: countResult[0].count, page, limit });
});

export default router;
