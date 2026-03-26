import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { db, pipelines, pipelineStages, users } from '@buildkit/shared';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Dashboard API', () => {
  beforeEach(async () => {
    await cleanDb();

    // Create user referenced by auth token
    await db.insert(users).values({
      id: TEST_USER_ID,
      email: 'test@buildkitlabs.com',
      name: 'Test User',
      role: 'admin',
    });

    // Create prerequisite data
    const companyRes = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Dashboard Co', type: 'construction' });

    const [pipeline] = await db.insert(pipelines).values({ name: 'Sales Pipeline' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Discovery', position: 1 }).returning();

    // Create deals: 2 open, 1 won
    await request(app).post('/api/deals').set(authHeaders()).send({
      companyId: companyRes.body.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: 'Open Deal 1',
      value: 50000,
    });

    await request(app).post('/api/deals').set(authHeaders()).send({
      companyId: companyRes.body.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: 'Open Deal 2',
      value: 75000,
    });

    const wonDealRes = await request(app).post('/api/deals').set(authHeaders()).send({
      companyId: companyRes.body.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      title: 'Won Deal',
      value: 100000,
    });

    await request(app)
      .patch(`/api/deals/${wonDealRes.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });
  });

  it('GET /api/dashboard/stats returns aggregate deal statistics', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.activeDeals).toBe(2);
    expect(res.body.pipelineValue).toBe(125000);
    expect(res.body.wonDeals).toBe(1);
    expect(res.body.wonValue).toBe(100000);
  });
});
