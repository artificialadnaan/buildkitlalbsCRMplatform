import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { db, pipelines, pipelineStages, users } from '@buildkit/shared';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Activities API', () => {
  let dealId: string;

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
      .send({ name: 'Activity Test Co', type: 'local' });

    const [pipeline] = await db.insert(pipelines).values({ name: 'Pipeline' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Stage 1', position: 1 }).returning();

    const dealRes = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId: companyRes.body.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: 'Activity Deal',
        value: 10000,
      });
    dealId = dealRes.body.id;
  });

  it('POST /api/activities logs an activity with userId from auth', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set(authHeaders())
      .send({
        dealId,
        type: 'note',
        subject: 'Initial outreach',
        body: 'Called the client to discuss project scope.',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('note');
    expect(res.body.subject).toBe('Initial outreach');
    expect(res.body.userId).toBe(TEST_USER_ID);
    expect(res.body.dealId).toBe(dealId);
  });

  it('GET /api/activities?dealId filters by deal', async () => {
    // Create two activities on this deal
    await request(app).post('/api/activities').set(authHeaders()).send({ dealId, type: 'call', subject: 'Follow-up call' });
    await request(app).post('/api/activities').set(authHeaders()).send({ dealId, type: 'email', subject: 'Sent proposal' });

    const res = await request(app)
      .get(`/api/activities?dealId=${dealId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});
