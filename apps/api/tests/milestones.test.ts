import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, users, projects, milestones, tasks } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Milestones API', () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com',
      name: 'Test User',
      role: 'admin',
    });
    const [company] = await db.insert(companies).values({ name: 'Test Co', type: 'local' }).returning();
    const [project] = await db.insert(projects).values({
      companyId: company.id,
      name: 'Test Project',
      type: 'website',
    }).returning();
    projectId = project.id;
  });

  it('POST /api/projects/:projectId/milestones creates a milestone', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/milestones`)
      .set(authHeaders())
      .send({ name: 'Design Phase', position: 1 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Design Phase');
    expect(res.body.position).toBe(1);
    expect(res.body.status).toBe('pending');
    expect(res.body.projectId).toBe(projectId);
  });

  it('GET /api/projects/:projectId/milestones returns milestones sorted by position', async () => {
    await db.insert(milestones).values([
      { projectId, name: 'Development', position: 2 },
      { projectId, name: 'Discovery', position: 1 },
      { projectId, name: 'Launch', position: 3 },
    ]);

    const res = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].name).toBe('Discovery');
    expect(res.body[1].name).toBe('Development');
    expect(res.body[2].name).toBe('Launch');
  });

  it('PATCH /api/projects/:projectId/milestones/:id updates a milestone', async () => {
    const [milestone] = await db.insert(milestones).values({
      projectId,
      name: 'Old Name',
      position: 1,
    }).returning();

    const res = await request(app)
      .patch(`/api/projects/${projectId}/milestones/${milestone.id}`)
      .set(authHeaders())
      .send({ name: 'New Name', status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.status).toBe('in_progress');
  });

  it('DELETE /api/projects/:projectId/milestones/:id deletes a milestone', async () => {
    const [milestone] = await db.insert(milestones).values({
      projectId,
      name: 'Delete Me',
      position: 1,
    }).returning();

    const res = await request(app)
      .delete(`/api/projects/${projectId}/milestones/${milestone.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('auto-completes milestone when all tasks are marked done', async () => {
    const [milestone] = await db.insert(milestones).values({
      projectId,
      name: 'Auto Complete Test',
      position: 1,
      status: 'in_progress',
    }).returning();

    const userId = '00000000-0000-0000-0000-000000000001';

    // Create two tasks
    const [task1] = await db.insert(tasks).values({
      milestoneId: milestone.id,
      title: 'Task 1',
      assignedTo: userId,
    }).returning();
    const [task2] = await db.insert(tasks).values({
      milestoneId: milestone.id,
      title: 'Task 2',
      assignedTo: userId,
    }).returning();

    // Complete task 1
    await request(app)
      .patch(`/api/milestones/${milestone.id}/tasks/${task1.id}`)
      .set(authHeaders())
      .send({ status: 'done' });

    // Milestone should NOT be done yet
    let msRes = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(authHeaders());
    const ms1 = msRes.body.find((m: { id: string }) => m.id === milestone.id);
    expect(ms1.status).toBe('in_progress');

    // Complete task 2
    await request(app)
      .patch(`/api/milestones/${milestone.id}/tasks/${task2.id}`)
      .set(authHeaders())
      .send({ status: 'done' });

    // Milestone SHOULD be done now
    msRes = await request(app)
      .get(`/api/projects/${projectId}/milestones`)
      .set(authHeaders());
    const ms2 = msRes.body.find((m: { id: string }) => m.id === milestone.id);
    expect(ms2.status).toBe('done');
  });
});
