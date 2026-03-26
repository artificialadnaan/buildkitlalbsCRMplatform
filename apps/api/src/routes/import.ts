import { Router } from 'express';
import { db, companies } from '@buildkit/shared';
import type { CompanyType } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { parseCSV } from '../lib/csv.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  'company name': 'name',
  company: 'name',
  type: 'type',
  'company type': 'type',
  phone: 'phone',
  telephone: 'phone',
  website: 'website',
  url: 'website',
  city: 'city',
  state: 'state',
  zip: 'zip',
  'zip code': 'zip',
  zipcode: 'zip',
  postal: 'zip',
  industry: 'industry',
  address: 'address',
};

const VALID_TYPES = new Set(['local', 'construction']);

interface ImportRow {
  name?: string;
  type?: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  zip?: string;
  industry?: string;
  address?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

router.post('/companies', async (req, res) => {
  const { csv, dryRun } = req.body as { csv: string; dryRun: boolean };

  if (!csv || typeof csv !== 'string') {
    res.status(400).json({ error: 'csv string is required' });
    return;
  }

  const parsed = parseCSV(csv);
  if (parsed.length < 2) {
    res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
    return;
  }

  const [headerRow, ...dataRows] = parsed;

  // Auto-map columns from headers
  const columnMapping: (string | null)[] = headerRow.map((h) => {
    const key = h.toLowerCase().trim();
    return COLUMN_MAP[key] ?? null;
  });

  // Parse rows into objects
  const rows: ImportRow[] = dataRows.map((row) => {
    const obj: ImportRow = {};
    row.forEach((val, i) => {
      const field = columnMapping[i];
      if (field && val.trim()) {
        (obj as Record<string, string>)[field] = val.trim();
      }
    });
    return obj;
  });

  // Validate
  const errors: ValidationError[] = [];
  rows.forEach((row, i) => {
    if (!row.name) {
      errors.push({ row: i + 2, field: 'name', message: 'Company name is required' });
    }
    if (row.type && !VALID_TYPES.has(row.type.toLowerCase())) {
      errors.push({ row: i + 2, field: 'type', message: `Invalid type "${row.type}". Must be "local" or "construction"` });
    }
  });

  // Check for duplicates against existing companies
  const existingCompanies = await db.select({ name: companies.name }).from(companies);
  const existingNames = new Set(existingCompanies.map((c) => c.name.toLowerCase()));

  const duplicates: number[] = [];
  const newRows: { row: ImportRow; index: number }[] = [];

  rows.forEach((row, i) => {
    if (!row.name) return;
    if (existingNames.has(row.name.toLowerCase())) {
      duplicates.push(i + 2);
    } else {
      newRows.push({ row, index: i + 2 });
    }
  });

  if (dryRun) {
    res.json({
      totalRows: rows.length,
      validRows: rows.length - errors.filter((e) => e.field === 'name').length,
      newCount: newRows.length,
      duplicateCount: duplicates.length,
      duplicateRows: duplicates,
      errors,
      preview: rows.slice(0, 10),
      columnMapping: headerRow.map((h, i) => ({ header: h, mappedTo: columnMapping[i] })),
    });
    return;
  }

  // Abort on validation errors for required fields
  const nameErrors = errors.filter((e) => e.field === 'name');
  if (nameErrors.length > 0) {
    res.status(400).json({ error: 'Validation failed', errors: nameErrors });
    return;
  }

  // Insert new companies
  let insertedCount = 0;
  for (const { row } of newRows) {
    await db.insert(companies).values({
      name: row.name!,
      type: (VALID_TYPES.has(row.type?.toLowerCase() ?? '') ? row.type!.toLowerCase() : 'local') as CompanyType,
      phone: row.phone || null,
      website: row.website || null,
      city: row.city || null,
      state: row.state || null,
      zip: row.zip || null,
      industry: row.industry || null,
      address: row.address || null,
      source: 'manual',
    });
    insertedCount++;
  }

  res.json({ inserted: insertedCount, skippedDuplicates: duplicates.length, errors });
});

export default router;
