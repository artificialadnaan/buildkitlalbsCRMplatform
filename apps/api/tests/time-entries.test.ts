import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, users, projects } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Time Entries API', () => {
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    await cleanDb();
    const [user] = await db.insert(users).values({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@buildkitlabs.com',
      name: 'Test User',
      role: 'admin',
    }).returning();
    userId = user.id;

    const [company] = await db.insert(companies).values({ name: 'Test Co', type: 'local' }).returning();
    const [project] = await db.insert(projects).values({
      companyId: company.id,
      name: 'Test Project',
      type: 'website',
    }).returning();
    projectId = project.id;
  });

  it('POST /api/time-entries creates a time entry', async () => {
    const res = await request(app)
      .post('/api/time-entries')
      .set(authHeaders())
      .send({
        projectId,
        description: 'Worked on homepage design',
        durationMinutes: 120,
        date: '2026-03-25',
        billable: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.durationMinutes).toBe(120);
    expect(res.body.billable).toBe(true);
    expect(res.body.userId).toBe(userId);
  });

  it('GET /api/time-entries returns entries filtered by project', async () => {
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'Entry 1', durationMinutes: 60, date: '2026-03-25' });
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'Entry 2', durationMinutes: 90, date: '2026-03-25' });

    const res = await request(app)
      .get(`/api/time-entries?projectId=${projectId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /api/time-entries returns entries filtered by userId', async () => {
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'My time', durationMinutes: 30, date: '2026-03-25' });

    const res = await request(app)
      .get(`/api/time-entries?userId=${userId}`)
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
  });

  it('PATCH /api/time-entries/:id updates a time entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set(authHeaders())
      .send({ projectId, description: 'Old', durationMinutes: 60, date: '2026-03-25' });

    const res = await request(app)
      .patch(`/api/time-entries/${created.body.id}`)
      .set(authHeaders())
      .send({ description: 'Updated', durationMinutes: 90, billable: false });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated');
    expect(res.body.durationMinutes).toBe(90);
    expect(res.body.billable).toBe(false);
  });

  it('DELETE /api/time-entries/:id deletes a time entry', async () => {
    const created = await request(app)
      .post('/api/time-entries')
      .set(authHeaders())
      .send({ projectId, description: 'Delete', durationMinutes: 30, date: '2026-03-25' });

    const res = await request(app)
      .delete(`/api/time-entries/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/time-entries/summary returns aggregated hours', async () => {
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'Billable work', durationMinutes: 120, date: '2026-03-25', billable: true });
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'Non-billable', durationMinutes: 60, date: '2026-03-25', billable: false });
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'More billable', durationMinutes: 30, date: '2026-03-26', billable: true });

    const res = await request(app)
      .get(`/api/time-entries/summary?projectId=${projectId}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.totalMinutes).toBe(210);
    expect(res.body.billableMinutes).toBe(150);
    expect(res.body.nonBillableMinutes).toBe(60);
  });

  it('GET /api/time-entries/summary groups by user', async () => {
    await request(app).post('/api/time-entries').set(authHeaders())
      .send({ projectId, description: 'Work', durationMinutes: 120, date: '2026-03-25' });

    const res = await request(app)
      .get(`/api/time-entries/summary?projectId=${projectId}`)
      .set(authHeaders());

    expect(res.body.byUser).toHaveLength(1);
    expect(res.body.byUser[0].userName).toBe('Test User');
    expect(res.body.byUser[0].totalMinutes).toBe(120);
  });
});
