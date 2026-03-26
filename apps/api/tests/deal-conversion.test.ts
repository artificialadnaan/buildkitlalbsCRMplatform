import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, pipelines, pipelineStages, companies, contacts, deals, projects, milestones, portalUsers } from '@buildkit/shared';
import { authHeaders, cleanDb, seedMilestoneTemplates } from './setup.js';

const app = createApp();

describe('Deal -> Project Conversion', () => {
  let companyId: string;
  let contactId: string;
  let pipelineId: string;
  let stageId: string;
  let wonStageId: string;

  beforeEach(async () => {
    await cleanDb();
    await seedMilestoneTemplates();

    const [company] = await db.insert(companies).values({ name: 'Acme Roofing', type: 'local' }).returning();
    companyId = company.id;

    const [contact] = await db.insert(contacts).values({
      companyId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@acmeroofing.com',
      isPrimary: true,
    }).returning();
    contactId = contact.id;

    const [pipeline] = await db.insert(pipelines).values({ name: 'Local Business' }).returning();
    pipelineId = pipeline.id;
    const [s1] = await db.insert(pipelineStages).values({ pipelineId, name: 'New Lead', position: 1 }).returning();
    const [s2] = await db.insert(pipelineStages).values({ pipelineId, name: 'Won', position: 6 }).returning();
    stageId = s1.id;
    wonStageId = s2.id;
  });

  it('PATCH /api/deals/:id with status=won creates a project', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        contactId,
        pipelineId,
        stageId,
        title: 'Acme Website Redesign',
        value: 5000,
      });

    const res = await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('won');

    // Verify project was created
    const projectRes = await request(app)
      .get('/api/projects')
      .set(authHeaders());

    expect(projectRes.body.data).toHaveLength(1);
    expect(projectRes.body.data[0].name).toBe('Acme Website Redesign');
    expect(projectRes.body.data[0].budget).toBe(5000);
    expect(projectRes.body.data[0].companyId).toBe(companyId);
  });

  it('created project gets milestones from website template when pipeline is Local Business', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        contactId,
        pipelineId,
        stageId,
        title: 'Acme Website',
        value: 3000,
      });

    await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    // Get the project
    const projectRes = await request(app)
      .get('/api/projects')
      .set(authHeaders());

    const projectId = projectRes.body.data[0].id;

    // Get milestones
    const milestonesRes = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(authHeaders());

    expect(milestonesRes.body).toHaveLength(4);
    expect(milestonesRes.body[0].name).toBe('Discovery');
    expect(milestonesRes.body[1].name).toBe('Design');
    expect(milestonesRes.body[2].name).toBe('Development');
    expect(milestonesRes.body[3].name).toBe('Launch');
  });

  it('created project gets milestones from software template when pipeline is Construction', async () => {
    // Create a construction pipeline
    const [constructionPipeline] = await db.insert(pipelines).values({ name: 'Construction' }).returning();
    const [cs1] = await db.insert(pipelineStages).values({ pipelineId: constructionPipeline.id, name: 'Identified', position: 1 }).returning();

    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        contactId,
        pipelineId: constructionPipeline.id,
        stageId: cs1.id,
        title: 'T Rock Platform',
        value: 28000,
      });

    await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    const projectRes = await request(app)
      .get('/api/projects')
      .set(authHeaders());

    const projectId = projectRes.body.data[0].id;
    expect(projectRes.body.data[0].type).toBe('software');

    const milestonesRes = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(authHeaders());

    expect(milestonesRes.body).toHaveLength(6);
    expect(milestonesRes.body[0].name).toBe('Discovery');
    expect(milestonesRes.body[5].name).toBe('Launch');
  });

  it('creates a portal_user for the primary contact on deal won', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        contactId,
        pipelineId,
        stageId,
        title: 'Portal Test',
        value: 1000,
      });

    await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    // Verify portal_user was created
    const [portalUser] = await db.select().from(portalUsers).limit(1);
    expect(portalUser).toBeDefined();
    expect(portalUser.contactId).toBe(contactId);
    expect(portalUser.companyId).toBe(companyId);
    expect(portalUser.email).toBe('john@acmeroofing.com');
  });

  it('does not create duplicate project if deal is already won', async () => {
    const created = await request(app)
      .post('/api/deals')
      .set(authHeaders())
      .send({
        companyId,
        contactId,
        pipelineId,
        stageId,
        title: 'Dup Test',
        value: 2000,
      });

    // Win once
    await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    // Try to "win" again (e.g., update another field)
    await request(app)
      .patch(`/api/deals/${created.body.id}`)
      .set(authHeaders())
      .send({ status: 'won' });

    const projectRes = await request(app)
      .get('/api/projects')
      .set(authHeaders());

    expect(projectRes.body.data).toHaveLength(1);
  });
});
