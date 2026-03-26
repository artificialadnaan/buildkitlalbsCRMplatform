import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, users, companies, contacts, deals, pipelines, pipelineStages, emailTemplates } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Email Sends API', () => {
  let dealId: string;
  let contactId: string;
  let templateId: string;

  beforeEach(async () => {
    await cleanDb();
    await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com', name: 'Test User', role: 'admin',
    });
    const [company] = await db.insert(companies).values({ name: 'Test Co', type: 'local' }).returning();
    const [contact] = await db.insert(contacts).values({
      companyId: company.id, firstName: 'John', lastName: 'Doe', email: 'john@testco.com',
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
      name: 'Test Template', subject: 'Hello {{contact.first_name}}',
      bodyHtml: '<p>Hi {{contact.first_name}}</p>', pipelineType: 'local',
    }).returning();
    templateId = template.id;
  });

  it('POST /api/email-sends queues an email send', async () => {
    const res = await request(app)
      .post('/api/email-sends')
      .set(authHeaders())
      .send({
        dealId,
        contactId,
        templateId,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('queued');
    expect(res.body.dealId).toBe(dealId);
    expect(res.body.contactId).toBe(contactId);
  });

  it('POST /api/email-sends accepts custom subject and body (one-off)', async () => {
    const res = await request(app)
      .post('/api/email-sends')
      .set(authHeaders())
      .send({
        dealId,
        contactId,
        subject: 'Custom Subject',
        bodyHtml: '<p>Custom body</p>',
      });

    expect(res.status).toBe(201);
    expect(res.body.subject).toBe('Custom Subject');
    expect(res.body.templateId).toBeNull();
  });

  it('GET /api/email-sends?dealId= returns sends for a deal', async () => {
    await request(app).post('/api/email-sends').set(authHeaders()).send({
      dealId, contactId, subject: 'Email 1', bodyHtml: '<p>1</p>',
    });
    await request(app).post('/api/email-sends').set(authHeaders()).send({
      dealId, contactId, subject: 'Email 2', bodyHtml: '<p>2</p>',
    });

    const res = await request(app)
      .get(`/api/email-sends?dealId=${dealId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /api/email-sends/daily-count returns today send count', async () => {
    await request(app).post('/api/email-sends').set(authHeaders()).send({
      dealId, contactId, subject: 'Test', bodyHtml: '<p>T</p>',
    });

    const res = await request(app)
      .get('/api/email-sends/daily-count')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(0);
    expect(res.body.limit).toBe(2000);
  });
});
