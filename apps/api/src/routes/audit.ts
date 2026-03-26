import { Router } from 'express';
import { desc, eq, and, sql } from 'drizzle-orm';
import { db, auditLog, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  const { entity, entityId, userId } = req.query;
  const limit = parseInt(req.query.limit as string) || 100;

  const conditions = [];
  if (entity) conditions.push(eq(auditLog.entity, entity as string));
  if (entityId) conditions.push(eq(auditLog.entityId, entityId as string));
  if (userId) conditions.push(eq(auditLog.userId, userId as string));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db.select({
    log: auditLog,
    userName: users.name,
  })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.userId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  res.json(data);
});

export default router;
