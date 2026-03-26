import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Companies API', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('POST /api/companies creates a company', async () => {
    const res = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({
        name: 'Test Plumbing Co',
        type: 'local',
        phone: '555-1234',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Plumbing Co');
    expect(res.body.type).toBe('local');
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/companies returns list with pagination', async () => {
    await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Company A', type: 'local' });

    const res = await request(app)
      .get('/api/companies')
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('GET /api/companies filters by type', async () => {
    await request(app).post('/api/companies').set(authHeaders()).send({ name: 'Local Co', type: 'local' });
    await request(app).post('/api/companies').set(authHeaders()).send({ name: 'Construction Co', type: 'construction' });

    const res = await request(app)
      .get('/api/companies?type=construction')
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Construction Co');
  });

  it('PATCH /api/companies/:id updates a company', async () => {
    const created = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Old Name', type: 'local' });

    const res = await request(app)
      .patch(`/api/companies/${created.body.id}`)
      .set(authHeaders())
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('DELETE /api/companies/:id deletes a company (admin only)', async () => {
    const created = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'To Delete', type: 'local' });

    const res = await request(app)
      .delete(`/api/companies/${created.body.id}`)
      .set(authHeaders({ role: 'admin' }));

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/companies/${created.body.id}`)
      .set(authHeaders());

    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/companies/:id returns 403 for reps', async () => {
    const created = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Protected', type: 'local' });

    const res = await request(app)
      .delete(`/api/companies/${created.body.id}`)
      .set(authHeaders({ role: 'rep' }));

    expect(res.status).toBe(403);
  });

  it('GET /api/companies supports search by name', async () => {
    await request(app).post('/api/companies').set(authHeaders()).send({ name: 'Dallas Plumbing', type: 'local' });
    await request(app).post('/api/companies').set(authHeaders()).send({ name: 'Fort Worth HVAC', type: 'local' });

    const res = await request(app)
      .get('/api/companies?search=plumbing')
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Dallas Plumbing');
  });
});
