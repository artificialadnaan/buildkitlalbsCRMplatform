import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, users, projects } from '@buildkit/shared';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Projects API', () => {
  let companyId: string;
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
    companyId = company.id;
  });

  it('POST /api/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(authHeaders())
      .send({
        companyId,
        name: 'Website Rebuild',
        type: 'website',
        budget: 8000,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Website Rebuild');
    expect(res.body.type).toBe('website');
    expect(res.body.status).toBe('active');
    expect(res.body.budget).toBe(8000);
  });

  it('GET /api/projects returns list with pagination', async () => {
    await db.insert(projects).values({ companyId, name: 'Project A', type: 'website', assignedTo: userId });
    await db.insert(projects).values({ companyId, name: 'Project B', type: 'software', assignedTo: userId });

    const res = await request(app)
      .get('/api/projects')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /api/projects filters by status', async () => {
    await db.insert(projects).values({ companyId, name: 'Active', type: 'website', status: 'active', assignedTo: userId });
    await db.insert(projects).values({ companyId, name: 'Done', type: 'website', status: 'completed', assignedTo: userId });

    const res = await request(app)
      .get('/api/projects?status=active')
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Active');
  });

  it('GET /api/projects filters by assignedTo', async () => {
    await db.insert(projects).values({ companyId, name: 'Mine', type: 'website', assignedTo: userId });

    const res = await request(app)
      .get(`/api/projects?assignedTo=${userId}`)
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mine');
  });

  it('GET /api/projects/:id returns a single project with company name', async () => {
    const [project] = await db.insert(projects).values({
      companyId,
      name: 'Detail Test',
      type: 'software',
      assignedTo: userId,
      budget: 15000,
    }).returning();

    const res = await request(app)
      .get(`/api/projects/${project.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Detail Test');
    expect(res.body.companyName).toBe('Test Co');
    expect(res.body.assignedToName).toBe('Test User');
  });

  it('PATCH /api/projects/:id updates a project', async () => {
    const [project] = await db.insert(projects).values({
      companyId,
      name: 'Old Name',
      type: 'website',
    }).returning();

    const res = await request(app)
      .patch(`/api/projects/${project.id}`)
      .set(authHeaders())
      .send({ name: 'New Name', status: 'on_hold' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.status).toBe('on_hold');
  });

  it('GET /api/projects/:id returns 404 for non-existent project', async () => {
    const res = await request(app)
      .get('/api/projects/00000000-0000-0000-0000-000000000099')
      .set(authHeaders());

    expect(res.status).toBe(404);
  });
});
