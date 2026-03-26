import { Router } from 'express';
import { db, companies, deals, contacts, timeEntries, pipelineStages, users, projects, scrapeJobs } from '@buildkit/shared';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function escapeCSV(val: unknown): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => headers.map(h => escapeCSV(row[h])).join(','));
  return [headerLine, ...dataLines].join('\n');
}

router.get('/companies', async (req, res) => {
  const data = await db.select().from(companies).limit(10000);
  const csv = toCSV(
    ['name', 'type', 'phone', 'website', 'city', 'state', 'zip', 'industry', 'source', 'score'],
    data as Record<string, unknown>[]
  );
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="companies-${date}.csv"`);
  res.send(csv);
});

router.get('/contacts', async (req, res) => {
  const data = await db.select({
    firstName: contacts.firstName, lastName: contacts.lastName,
    email: contacts.email, phone: contacts.phone, title: contacts.title,
    companyName: companies.name,
  }).from(contacts).leftJoin(companies, eq(contacts.companyId, companies.id)).limit(10000);
  const csv = toCSV(['firstName', 'lastName', 'email', 'phone', 'title', 'companyName'], data as Record<string, unknown>[]);
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="contacts-${date}.csv"`);
  res.send(csv);
});

router.get('/deals', async (req, res) => {
  const data = await db.select({
    title: deals.title, value: deals.value, status: deals.status,
    companyName: companies.name, stageName: pipelineStages.name,
  }).from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .limit(10000);
  const csv = toCSV(['title', 'value', 'status', 'companyName', 'stageName'], data as Record<string, unknown>[]);
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="deals-${date}.csv"`);
  res.send(csv);
});

router.get('/time-entries', async (req, res) => {
  const data = await db.select({
    description: timeEntries.description, durationMinutes: timeEntries.durationMinutes,
    date: timeEntries.date, billable: timeEntries.billable,
    projectName: projects.name, userName: users.name,
  }).from(timeEntries)
    .leftJoin(projects, eq(timeEntries.projectId, projects.id))
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .limit(10000);
  const csv = toCSV(['description', 'durationMinutes', 'date', 'billable', 'projectName', 'userName'], data as Record<string, unknown>[]);
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="time-entries-${date}.csv"`);
  res.send(csv);
});

router.get('/scrape/:jobId', async (req, res) => {
  const { jobId } = req.params;

  const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, jobId)).limit(1);
  if (!job) {
    res.status(404).json({ error: 'Scrape job not found' });
    return;
  }

  const data = await db.select({
    name: companies.name,
    phone: companies.phone,
    email: contacts.email,
    website: companies.website,
    city: companies.city,
    state: companies.state,
    zip: companies.zip,
    industry: companies.industry,
    score: companies.score,
    websiteScore: companies.websiteScore,
  }).from(companies)
    .leftJoin(contacts, eq(contacts.companyId, companies.id))
    .where(eq(companies.scrapeJobId, jobId))
    .limit(10000);

  const csv = toCSV(
    ['name', 'phone', 'email', 'website', 'city', 'state', 'zip', 'industry', 'score', 'websiteScore'],
    data as Record<string, unknown>[]
  );

  const slug = job.searchQuery.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const date = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="scrape-${slug}-${date}.csv"`);
  res.send(csv);
});

export default router;
