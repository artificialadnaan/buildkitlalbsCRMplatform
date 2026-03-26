import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  db, users, companies, contacts, deals, pipelines, pipelineStages,
  emailTemplates, emailSequences, sequenceSteps,
} from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Sequence Enrollments API', () => {
  let dealId: string;
  let contactId: string;
  let sequenceId: string;

  beforeEach(async () => {
    await cleanDb();
    await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com', name: 'Test User', role: 'admin',
    });
    const [company] = await db.insert(companies).values({ name: 'Test Co', type: 'local' }).returning();
    const [contact] = await db.insert(contacts).values({
      companyId: company.id, firstName: 'John', email: 'john@testco.com',
    }).returning();
    contactId = contact.id;
    const [pipeline] = await db.insert(pipelines).values({ name: 'Test' }).returning();
    const [stage] = await db.insert(pipelineStages).values({
      pipelineId: pipeline.id, name: 'New', position: 1,
    }).returning();
    const [deal] = await db.insert(deals).values({
      companyId: company.id, contactId: contact.id, pipelineId: pipeline.id, stageId: stage.id, title: 'Test Deal',
    }).returning();
    dealId = deal.id;
    const [template] = await db.insert(emailTemplates).values({
      name: 'T1', subject: 'S', bodyHtml: '<p>B</p>', pipelineType: 'local',
    }).returning();
    const [sequence] = await db.insert(emailSequences).values({
      name: 'Test Sequence', pipelineType: 'local',
    }).returning();
    sequenceId = sequence.id;
    await db.insert(sequenceSteps).values([
      { sequenceId: sequence.id, templateId: template.id, stepNumber: 1, delayDays: 0 },
      { sequenceId: sequence.id, templateId: template.id, stepNumber: 2, delayDays: 5 },
    ]);
  });

  it('POST /api/sequence-enrollments enrolls a deal in a sequence', async () => {
    const res = await request(app)
      .post('/api/sequence-enrollments')
      .set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(res.body.currentStep).toBe(1);
    expect(res.body.nextSendAt).toBeDefined();
  });

  it('POST /api/sequence-enrollments rejects duplicate active enrollment', async () => {
    await request(app).post('/api/sequence-enrollments').set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    const res = await request(app)
      .post('/api/sequence-enrollments')
      .set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    expect(res.status).toBe(409);
  });

  it('PATCH /api/sequence-enrollments/:id/pause pauses an enrollment', async () => {
    const created = await request(app).post('/api/sequence-enrollments').set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    const res = await request(app)
      .patch(`/api/sequence-enrollments/${created.body.id}/pause`)
      .set(authHeaders())
      .send({ reason: 'manual' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paused');
    expect(res.body.pausedReason).toBe('manual');
  });

  it('PATCH /api/sequence-enrollments/:id/resume resumes a paused enrollment', async () => {
    const created = await request(app).post('/api/sequence-enrollments').set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    await request(app)
      .patch(`/api/sequence-enrollments/${created.body.id}/pause`)
      .set(authHeaders())
      .send({ reason: 'manual' });

    const res = await request(app)
      .patch(`/api/sequence-enrollments/${created.body.id}/resume`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.pausedReason).toBeNull();
    expect(res.body.nextSendAt).toBeDefined();
  });

  it('PATCH /api/sequence-enrollments/:id/cancel cancels an enrollment', async () => {
    const created = await request(app).post('/api/sequence-enrollments').set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    const res = await request(app)
      .patch(`/api/sequence-enrollments/${created.body.id}/cancel`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('GET /api/sequence-enrollments?dealId= returns enrollments for a deal', async () => {
    await request(app).post('/api/sequence-enrollments').set(authHeaders())
      .send({ dealId, sequenceId, contactId });

    const res = await request(app)
      .get(`/api/sequence-enrollments?dealId=${dealId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('active');
  });
});
