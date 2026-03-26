import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { db, pipelines } from '@buildkit/shared';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Pipelines API', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  async function createPipeline(name = 'Sales Pipeline') {
    const [pipeline] = await db.insert(pipelines).values({ name }).returning();
    return pipeline;
  }

  it('GET /api/pipelines returns pipelines with nested stages', async () => {
    const pipeline = await createPipeline();

    await request(app)
      .post(`/api/pipelines/${pipeline.id}/stages`)
      .set(authHeaders({ role: 'admin' }))
      .send({ name: 'Discovery', position: 1, color: '#3B82F6' });

    await request(app)
      .post(`/api/pipelines/${pipeline.id}/stages`)
      .set(authHeaders({ role: 'admin' }))
      .send({ name: 'Proposal', position: 2, color: '#F59E0B' });

    const res = await request(app)
      .get('/api/pipelines')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Sales Pipeline');
    expect(res.body[0].stages).toHaveLength(2);
    expect(res.body[0].stages[0].name).toBe('Discovery');
    expect(res.body[0].stages[1].name).toBe('Proposal');
  });

  it('POST /api/pipelines/:id/stages creates a stage (admin only)', async () => {
    const pipeline = await createPipeline();

    const res = await request(app)
      .post(`/api/pipelines/${pipeline.id}/stages`)
      .set(authHeaders({ role: 'admin' }))
      .send({ name: 'Negotiation', position: 3, color: '#10B981' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Negotiation');
    expect(res.body.pipelineId).toBe(pipeline.id);
    expect(res.body.position).toBe(3);
  });

  it('POST /api/pipelines/:id/stages returns 403 for reps', async () => {
    const pipeline = await createPipeline();

    const res = await request(app)
      .post(`/api/pipelines/${pipeline.id}/stages`)
      .set(authHeaders({ role: 'rep' }))
      .send({ name: 'Blocked Stage', position: 1 });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/pipelines/stages/:id updates a stage', async () => {
    const pipeline = await createPipeline();

    const created = await request(app)
      .post(`/api/pipelines/${pipeline.id}/stages`)
      .set(authHeaders({ role: 'admin' }))
      .send({ name: 'Old Name', position: 1 });

    const res = await request(app)
      .patch(`/api/pipelines/stages/${created.body.id}`)
      .set(authHeaders({ role: 'admin' }))
      .send({ name: 'New Name', color: '#EF4444' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.color).toBe('#EF4444');
  });
});
