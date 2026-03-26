import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, emailTemplates } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Email Sequences API', () => {
  let templateId1: string;
  let templateId2: string;

  beforeEach(async () => {
    await cleanDb();
    const [t1] = await db.insert(emailTemplates).values({
      name: 'Touch 1', subject: 'S1', bodyHtml: '<p>1</p>', pipelineType: 'construction',
    }).returning();
    const [t2] = await db.insert(emailTemplates).values({
      name: 'Touch 2', subject: 'S2', bodyHtml: '<p>2</p>', pipelineType: 'construction',
    }).returning();
    templateId1 = t1.id;
    templateId2 = t2.id;
  });

  it('POST /api/email-sequences creates a sequence with steps', async () => {
    const res = await request(app)
      .post('/api/email-sequences')
      .set(authHeaders())
      .send({
        name: 'Construction Outreach',
        pipelineType: 'construction',
        steps: [
          { templateId: templateId1, stepNumber: 1, delayDays: 0 },
          { templateId: templateId2, stepNumber: 2, delayDays: 5 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.sequence.name).toBe('Construction Outreach');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].delayDays).toBe(0);
    expect(res.body.steps[1].delayDays).toBe(5);
  });

  it('GET /api/email-sequences returns list with step counts', async () => {
    await request(app).post('/api/email-sequences').set(authHeaders()).send({
      name: 'Seq A', pipelineType: 'construction', steps: [
        { templateId: templateId1, stepNumber: 1, delayDays: 0 },
      ],
    });
    await request(app).post('/api/email-sequences').set(authHeaders()).send({
      name: 'Seq B', pipelineType: 'local', steps: [
        { templateId: templateId1, stepNumber: 1, delayDays: 0 },
        { templateId: templateId2, stepNumber: 2, delayDays: 3 },
      ],
    });

    const res = await request(app).get('/api/email-sequences').set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /api/email-sequences/:id returns sequence with full steps', async () => {
    const created = await request(app).post('/api/email-sequences').set(authHeaders()).send({
      name: 'Detail Test', pipelineType: 'construction', steps: [
        { templateId: templateId1, stepNumber: 1, delayDays: 0 },
        { templateId: templateId2, stepNumber: 2, delayDays: 7 },
      ],
    });

    const res = await request(app)
      .get(`/api/email-sequences/${created.body.sequence.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.sequence.name).toBe('Detail Test');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].stepNumber).toBe(1);
    expect(res.body.steps[1].stepNumber).toBe(2);
  });

  it('PATCH /api/email-sequences/:id updates sequence and replaces steps', async () => {
    const created = await request(app).post('/api/email-sequences').set(authHeaders()).send({
      name: 'Old Name', pipelineType: 'construction', steps: [
        { templateId: templateId1, stepNumber: 1, delayDays: 0 },
      ],
    });

    const res = await request(app)
      .patch(`/api/email-sequences/${created.body.sequence.id}`)
      .set(authHeaders())
      .send({
        name: 'New Name',
        steps: [
          { templateId: templateId1, stepNumber: 1, delayDays: 0 },
          { templateId: templateId2, stepNumber: 2, delayDays: 3 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sequence.name).toBe('New Name');
    expect(res.body.steps).toHaveLength(2);
  });

  it('DELETE /api/email-sequences/:id deletes sequence and steps', async () => {
    const created = await request(app).post('/api/email-sequences').set(authHeaders()).send({
      name: 'Delete Me', pipelineType: 'local', steps: [
        { templateId: templateId1, stepNumber: 1, delayDays: 0 },
      ],
    });

    const res = await request(app)
      .delete(`/api/email-sequences/${created.body.sequence.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/email-sequences/${created.body.sequence.id}`)
      .set(authHeaders());

    expect(getRes.status).toBe(404);
  });
});
