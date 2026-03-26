import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, contacts, portalUsers, projects, messages, users, deals, pipelines, pipelineStages } from '@buildkit/shared';
import { createSession } from '../src/lib/redis.js';
import { cleanPortalDb, portalSessionHeader } from './setup.js';

const app = createApp();

describe('Portal Messages API', () => {
  let sessionId: string;
  let projectId: string;
  let contactId: string;

  beforeEach(async () => {
    await cleanPortalDb();

    const [company] = await db.insert(companies).values({ name: 'Client Co', type: 'local' }).returning();
    const [contact] = await db.insert(contacts).values({
      companyId: company.id, firstName: 'Jane', email: 'jane@client.com',
    }).returning();
    contactId = contact.id;
    const [portalUser] = await db.insert(portalUsers).values({
      contactId: contact.id, companyId: company.id, email: 'jane@client.com',
    }).returning();

    const [user] = await db.insert(users).values({
      email: 'adnaan@buildkitlabs.com', name: 'Adnaan', role: 'admin',
    }).returning();

    const [pipeline] = await db.insert(pipelines).values({ name: 'Test' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId: company.id, pipelineId: pipeline.id, stageId: stage.id, title: 'Deal', status: 'won',
    }).returning();
    const [project] = await db.insert(projects).values({
      dealId: deal.id, companyId: company.id, name: 'Test Project', type: 'website', status: 'active',
    }).returning();
    projectId = project.id;

    // Seed some messages
    await db.insert(messages).values([
      { projectId, senderType: 'team', senderId: user.id, body: 'Welcome to your project!' },
      { projectId, senderType: 'client', senderId: contact.id, body: 'Thanks!' },
    ]);

    sessionId = 'test-session-msg-456';
    await createSession(sessionId, {
      portalUserId: portalUser.id,
      contactId: contact.id,
      companyId: company.id,
      email: 'jane@client.com',
    });
  });

  it('GET /portal/messages/:projectId returns messages', async () => {
    const res = await request(app)
      .get(`/portal/messages/${projectId}`)
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].body).toBe('Welcome to your project!');
    expect(res.body[0].senderName).toBe('Adnaan');
  });

  it('POST /portal/messages/:projectId sends a client message', async () => {
    const res = await request(app)
      .post(`/portal/messages/${projectId}`)
      .set(portalSessionHeader(sessionId))
      .send({ body: 'When will the design be ready?' });

    expect(res.status).toBe(201);
    expect(res.body.senderType).toBe('client');
    expect(res.body.body).toBe('When will the design be ready?');
  });

  it('POST /portal/messages/:projectId returns 400 for empty body', async () => {
    const res = await request(app)
      .post(`/portal/messages/${projectId}`)
      .set(portalSessionHeader(sessionId))
      .send({ body: '' });

    expect(res.status).toBe(400);
  });

  it('GET /portal/messages/:projectId/unread returns unread count', async () => {
    const res = await request(app)
      .get(`/portal/messages/${projectId}/unread`)
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(1); // 1 team message not read
  });

  it('POST /portal/messages/:projectId/read marks team messages as read', async () => {
    await request(app)
      .post(`/portal/messages/${projectId}/read`)
      .set(portalSessionHeader(sessionId));

    const res = await request(app)
      .get(`/portal/messages/${projectId}/unread`)
      .set(portalSessionHeader(sessionId));

    expect(res.body.unread).toBe(0);
  });
});
