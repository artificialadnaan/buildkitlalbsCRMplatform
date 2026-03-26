import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, contacts, portalUsers, projects, milestones, deals, pipelines, pipelineStages } from '@buildkit/shared';
import { createSession } from '../src/lib/redis.js';
import { cleanPortalDb, portalSessionHeader } from './setup.js';

const app = createApp();

describe('Portal Projects API', () => {
  let sessionId: string;
  let companyId: string;
  let projectId: string;

  beforeEach(async () => {
    await cleanPortalDb();

    const [company] = await db.insert(companies).values({ name: 'Client Co', type: 'local' }).returning();
    companyId = company.id;
    const [contact] = await db.insert(contacts).values({
      companyId, firstName: 'Jane', email: 'jane@clientco.com',
    }).returning();
    const [portalUser] = await db.insert(portalUsers).values({
      contactId: contact.id, companyId, email: 'jane@clientco.com',
    }).returning();

    // Create pipeline + deal for project FK
    const [pipeline] = await db.insert(pipelines).values({ name: 'Test' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId, pipelineId: pipeline.id, stageId: stage.id, title: 'Website Build', status: 'won',
    }).returning();

    const [project] = await db.insert(projects).values({
      dealId: deal.id, companyId, name: 'Client Co Website', type: 'website', status: 'active',
    }).returning();
    projectId = project.id;

    await db.insert(milestones).values([
      { projectId, name: 'Discovery', status: 'done', position: 1 },
      { projectId, name: 'Design', status: 'in_progress', position: 2 },
      { projectId, name: 'Development', status: 'pending', position: 3 },
      { projectId, name: 'Launch', status: 'pending', position: 4 },
    ]);

    // Create session
    sessionId = 'test-session-proj-123';
    await createSession(sessionId, {
      portalUserId: portalUser.id,
      contactId: contact.id,
      companyId,
      email: 'jane@clientco.com',
    });
  });

  it('GET /portal/projects returns projects for the client company', async () => {
    const res = await request(app)
      .get('/portal/projects')
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Client Co Website');
  });

  it('GET /portal/projects scopes to company_id (no cross-company leak)', async () => {
    // Create another company's project
    const [otherCompany] = await db.insert(companies).values({ name: 'Other Co', type: 'construction' }).returning();
    const [pipeline] = await db.insert(pipelines).values({ name: 'Other' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId: otherCompany.id, pipelineId: pipeline.id, stageId: stage.id, title: 'Other', status: 'won',
    }).returning();
    await db.insert(projects).values({
      dealId: deal.id, companyId: otherCompany.id, name: 'Other Project', type: 'software', status: 'active',
    });

    const res = await request(app)
      .get('/portal/projects')
      .set(portalSessionHeader(sessionId));

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Client Co Website');
  });

  it('GET /portal/projects/:id returns project with milestones and progress', async () => {
    const res = await request(app)
      .get(`/portal/projects/${projectId}`)
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Client Co Website');
    expect(res.body.milestones).toHaveLength(4);
    expect(res.body.progressPercent).toBe(25); // 1 of 4 milestones done
  });

  it('GET /portal/projects returns 401 without session', async () => {
    const res = await request(app).get('/portal/projects');
    expect(res.status).toBe(401);
  });
});
