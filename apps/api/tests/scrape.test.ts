import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, users, scrapeJobs } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';
import { sql } from 'drizzle-orm';

const app = createApp();

describe('Scraper API', () => {
  beforeEach(async () => {
    await cleanDb();
    // Also clean scrape_jobs
    await db.execute(sql`TRUNCATE scrape_jobs CASCADE`);
    // Create test user
    await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com',
      name: 'Test User',
      role: 'admin',
    });
  });

  it('POST /api/scrape creates a scrape job and returns job ID', async () => {
    const res = await request(app)
      .post('/api/scrape')
      .set(authHeaders())
      .send({
        zipCodes: ['75201', '75202'],
        searchQuery: 'plumbers',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.zipCodes).toEqual(['75201', '75202']);
    expect(res.body.searchQuery).toBe('plumbers');
  });

  it('POST /api/scrape validates required fields', async () => {
    const res = await request(app)
      .post('/api/scrape')
      .set(authHeaders())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/scrape rejects empty zipCodes array', async () => {
    const res = await request(app)
      .post('/api/scrape')
      .set(authHeaders())
      .send({ zipCodes: [], searchQuery: 'plumbers' });

    expect(res.status).toBe(400);
  });

  it('GET /api/scrape/jobs returns list of scrape jobs', async () => {
    // Create a job first
    await request(app)
      .post('/api/scrape')
      .set(authHeaders())
      .send({ zipCodes: ['75201'], searchQuery: 'plumbers' });

    const res = await request(app)
      .get('/api/scrape/jobs')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].searchQuery).toBe('plumbers');
  });

  it('GET /api/scrape/jobs/:id returns a single job with progress', async () => {
    const created = await request(app)
      .post('/api/scrape')
      .set(authHeaders())
      .send({ zipCodes: ['75201'], searchQuery: 'plumbers' });

    const res = await request(app)
      .get(`/api/scrape/jobs/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.status).toBe('pending');
  });

  it('GET /api/scrape/jobs/:id returns 404 for non-existent job', async () => {
    const res = await request(app)
      .get('/api/scrape/jobs/00000000-0000-0000-0000-000000000099')
      .set(authHeaders());

    expect(res.status).toBe(404);
  });
});
