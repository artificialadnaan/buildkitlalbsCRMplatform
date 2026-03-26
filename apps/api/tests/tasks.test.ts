import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, users, projects, milestones } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Tasks API', () => {
  let milestoneId: string;

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
    const [milestone] = await db.insert(milestones).values({
      projectId: project.id,
      name: 'Development',
      position: 1,
    }).returning();
    milestoneId = milestone.id;
  });

  it('POST /api/milestones/:milestoneId/tasks creates a task', async () => {
    const res = await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({
        title: 'Set up project scaffolding',
        description: 'Initialize repo and install deps',
        priority: 'high',
        dueDate: '2026-04-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Set up project scaffolding');
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('high');
    expect(res.body.milestoneId).toBe(milestoneId);
  });

  it('GET /api/milestones/:milestoneId/tasks returns tasks for a milestone', async () => {
    await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Task A' });
    await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Task B' });

    const res = await request(app)
      .get(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('PATCH /api/milestones/:milestoneId/tasks/:id updates a task', async () => {
    const created = await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Original' });

    const res = await request(app)
      .patch(`/api/milestones/${milestoneId}/tasks/${created.body.id}`)
      .set(authHeaders())
      .send({ title: 'Updated', status: 'in_progress', priority: 'low' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.status).toBe('in_progress');
    expect(res.body.priority).toBe('low');
  });

  it('DELETE /api/milestones/:milestoneId/tasks/:id deletes a task', async () => {
    const created = await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Delete Me' });

    const res = await request(app)
      .delete(`/api/milestones/${milestoneId}/tasks/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('assigns task to a user', async () => {
    const userId = '00000000-0000-0000-0000-000000000001';

    const res = await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Assigned Task', assignedTo: userId });

    expect(res.body.assignedTo).toBe(userId);
  });

  it('GET /api/milestones/:milestoneId/tasks returns tasks with assignee names', async () => {
    const userId = '00000000-0000-0000-0000-000000000001';

    await request(app)
      .post(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders())
      .send({ title: 'Named Task', assignedTo: userId });

    const res = await request(app)
      .get(`/api/milestones/${milestoneId}/tasks`)
      .set(authHeaders());

    expect(res.body[0].assignedToName).toBe('Test User');
  });
});
