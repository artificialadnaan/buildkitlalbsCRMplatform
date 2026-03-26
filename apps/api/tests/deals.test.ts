import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { db, pipelines, pipelineStages } from '@buildkit/shared';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Deals API', () => {
  let companyId: string;
  let pipelineId: string;
  let stageId: string;
  let stage2Id: string;

  beforeEach(async () => {
    await cleanDb();

    // Create prerequisite company
    const companyRes = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Deal Test Co', type: 'construction' });
    companyId = companyRes.body.id;

    // Create pipeline and stages directly in DB
    const [pipeline] = await db.insert(pipelines).values({ name: 'Sales Pipeline' }).returning();
    pipelineId = pipeline.id;

    const [stage1] = await db.insert(pipelineStages).values({ pipelineId, name: 'Discovery', position: 1, color: '#3B82F6' }).returning();
    const [stage2] = await db.insert(pipelineStages).values({ pipelineId, name: 'Proposal', position: 2, color: '#F59E0B' }).returning();
    stageId = stage1.id;
    stage2Id = stage2.id;
  });

  it('POST /api/deals creates a deal', async () => {
    const res = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        pipelineId,
        stageId,
        title: 'New Office Build',
        value: 150000,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Office Build');
    expect(res.body.value).toBe(150000);
    expect(res.body.status).toBe('open');
    expect(res.body.id).toBeDefined();
  });

  it('PATCH /api/deals/:id/stage moves deal to a different stage', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({ companyId, pipelineId, stageId, title: 'Stage Move Test', value: 50000 });

    const res = await request(app)
      .patch(`/api/deals/${created.body.id}/stage`)
      .set(authHeaders())
      .send({ stageId: stage2Id });

    expect(res.status).toBe(200);
    expect(res.body.stageId).toBe(stage2Id);
  });

  it('GET /api/deals?pipelineId filters by pipeline', async () => {
    await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({ companyId, pipelineId, stageId, title: 'Deal A', value: 10000 });

    const res = await request(app)
      .get(`/api/deals?pipelineId=${pipelineId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].deal.title).toBe('Deal A');
    expect(res.body.data[0].companyName).toBe('Deal Test Co');
    expect(res.body.data[0].stageName).toBe('Discovery');
    expect(res.body.total).toBe(1);
  });

  it('PATCH /api/deals/:id with status=won sets closedAt', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({ companyId, pipelineId, stageId, title: 'Won Deal', value: 200000 });

    const res = await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('won');
    expect(res.body.closedAt).toBeDefined();
  });
});
