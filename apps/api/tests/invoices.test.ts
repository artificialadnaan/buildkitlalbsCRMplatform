import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, projects, invoices, users, deals, pipelines, pipelineStages, timeEntries } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Invoices API', () => {
  let projectId: string;
  let companyId: string;
  let userId: string;

  beforeEach(async () => {
    await cleanDb();
    const [user] = await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com', name: 'Test User', role: 'admin',
    }).returning();
    userId = user.id;
    const [company] = await db.insert(companies).values({ name: 'Client Co', type: 'local' }).returning();
    companyId = company.id;
    const [pipeline] = await db.insert(pipelines).values({ name: 'Test' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId, pipelineId: pipeline.id, stageId: stage.id, title: 'Deal', status: 'won',
    }).returning();
    const [project] = await db.insert(projects).values({
      dealId: deal.id, companyId, name: 'Website Build', type: 'website', status: 'active',
    }).returning();
    projectId = project.id;
  });

  it('POST /api/invoices creates an invoice with line items', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set(authHeaders())
      .send({
        projectId,
        dueDate: '2026-04-15',
        lineItems: [
          { description: 'Design phase', quantity: 1, unitPriceCents: 250000, type: 'fixed' },
          { description: 'Dev hours (10hrs @ $150)', quantity: 10, unitPriceCents: 15000, type: 'time_entry' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.amountCents).toBe(400000); // 250000 + (10 * 15000)
    expect(res.body.invoiceNumber).toMatch(/^INV-/);
    expect(res.body.lineItems).toHaveLength(2);
  });

  it('GET /api/invoices returns invoices with optional project filter', async () => {
    await request(app).post('/api/invoices').set(authHeaders()).send({
      projectId, dueDate: '2026-04-15',
      lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: 10000, type: 'fixed' }],
    });

    const res = await request(app)
      .get(`/api/invoices?projectId=${projectId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/invoices/:id returns a single invoice', async () => {
    const created = await request(app).post('/api/invoices').set(authHeaders()).send({
      projectId, dueDate: '2026-04-15',
      lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: 50000, type: 'fixed' }],
    });

    const res = await request(app)
      .get(`/api/invoices/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(50000);
  });

  it('PATCH /api/invoices/:id updates a draft invoice', async () => {
    const created = await request(app).post('/api/invoices').set(authHeaders()).send({
      projectId, dueDate: '2026-04-15',
      lineItems: [{ description: 'Old item', quantity: 1, unitPriceCents: 10000, type: 'fixed' }],
    });

    const res = await request(app)
      .patch(`/api/invoices/${created.body.id}`)
      .set(authHeaders())
      .send({
        dueDate: '2026-05-01',
        lineItems: [
          { description: 'Updated item', quantity: 2, unitPriceCents: 25000, type: 'fixed' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.amountCents).toBe(50000);
    expect(res.body.lineItems[0].description).toBe('Updated item');
  });

  it('PATCH /api/invoices/:id rejects updates to sent/paid invoices', async () => {
    const created = await request(app).post('/api/invoices').set(authHeaders()).send({
      projectId, dueDate: '2026-04-15',
      lineItems: [{ description: 'Item', quantity: 1, unitPriceCents: 10000, type: 'fixed' }],
    });

    // Manually set status to 'sent'
    await db.update(invoices).set({ status: 'sent' }).where(
      require('drizzle-orm').eq(invoices.id, created.body.id)
    );

    const res = await request(app)
      .patch(`/api/invoices/${created.body.id}`)
      .set(authHeaders())
      .send({ dueDate: '2026-06-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('draft');
  });

  it('GET /api/invoices/unbilled-time returns billable time entries', async () => {
    await db.insert(timeEntries).values([
      { projectId, userId, description: '10hrs design', durationMinutes: 600, date: new Date(), billable: true },
      { projectId, userId, description: '2hrs meeting', durationMinutes: 120, date: new Date(), billable: true },
      { projectId, userId, description: '1hr internal', durationMinutes: 60, date: new Date(), billable: false },
    ]);

    const res = await request(app)
      .get(`/api/invoices/unbilled-time?projectId=${projectId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2); // only billable entries
  });
});
