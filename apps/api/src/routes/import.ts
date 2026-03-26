import { Router } from 'express';
import { db, companies } from '@buildkit/shared';
import { ilike } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

router.post('/companies', async (req, res) => {
  const { csv, dryRun } = req.body;
  if (!csv) { res.status(400).json({ error: 'CSV data required' }); return; }

  const rows = parseCSV(csv);
  if (rows.length === 0) { res.status(400).json({ error: 'No data rows found' }); return; }

  const results = { total: rows.length, new: 0, duplicates: 0, errors: [] as string[], preview: [] as Record<string, string>[] };

  for (const row of rows) {
    if (!row.name) { results.errors.push(`Row missing name: ${JSON.stringify(row)}`); continue; }
    const existing = await db.select().from(companies).where(ilike(companies.name, row.name)).limit(1);
    if (existing.length > 0) { results.duplicates++; continue; }

    if (dryRun) {
      results.preview.push(row);
      results.new++;
    } else {
      try {
        await db.insert(companies).values({
          name: row.name,
          type: (row.type === 'construction' ? 'construction' : 'local') as 'local' | 'construction',
          phone: row.phone || null,
          website: row.website || null,
          city: row.city || null,
          state: row.state || null,
          zip: row.zip || null,
          industry: row.industry || null,
          source: 'manual',
        });
        results.new++;
      } catch (err) {
        results.errors.push(`Failed to import "${row.name}": ${err}`);
      }
    }
  }

  res.json(results);
});

export default router;
