import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /?q=term — Global search across entities
router.get('/', async (req, res) => {
  const q = req.query.q as string | undefined;

  if (!q || q.trim().length < 2) {
    res.status(400).json({ error: 'Query must be at least 2 characters' });
    return;
  }

  const term = `%${q.trim()}%`;

  const results = await db.execute(sql`
    SELECT 'company' AS type, id, name AS title, website AS subtitle
    FROM companies
    WHERE name ILIKE ${term}
    LIMIT 20

    UNION ALL

    SELECT 'contact' AS type, id,
      first_name || ' ' || COALESCE(last_name, '') AS title,
      email AS subtitle
    FROM contacts
    WHERE first_name ILIKE ${term}
      OR last_name ILIKE ${term}
      OR email ILIKE ${term}
    LIMIT 20

    UNION ALL

    SELECT 'deal' AS type, id, title, NULL AS subtitle
    FROM deals
    WHERE title ILIKE ${term}
    LIMIT 20

    UNION ALL

    SELECT 'project' AS type, id, name AS title, NULL AS subtitle
    FROM projects
    WHERE name ILIKE ${term}
    LIMIT 20

    LIMIT 20
  `);

  res.json(results.rows);
});

export default router;
