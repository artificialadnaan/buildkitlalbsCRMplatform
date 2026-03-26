import { Router } from 'express';
import { db, users } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// List all users (id, name, email, role)
router.get('/', async (_req, res) => {
  const data = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  }).from(users).orderBy(users.name);

  res.json(data);
});

export default router;
