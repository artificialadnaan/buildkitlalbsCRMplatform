import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Contacts API', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  async function createCompany() {
    const res = await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Test Company', type: 'local' });
    return res.body;
  }

  it('POST /api/contacts creates a contact linked to a company', async () => {
    const company = await createCompany();

    const res = await request(app)
      .post('/api/contacts')
      .set(authHeaders())
      .send({
        companyId: company.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-0001',
        title: 'Project Manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('John');
    expect(res.body.companyId).toBe(company.id);
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/contacts?companyId filters by company', async () => {
    const companyA = await createCompany();
    const companyB = (await request(app)
      .post('/api/companies')
      .set(authHeaders())
      .send({ name: 'Other Company', type: 'construction' })).body;

    await request(app).post('/api/contacts').set(authHeaders()).send({ companyId: companyA.id, firstName: 'Alice' });
    await request(app).post('/api/contacts').set(authHeaders()).send({ companyId: companyB.id, firstName: 'Bob' });

    const res = await request(app)
      .get(`/api/contacts?companyId=${companyA.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].firstName).toBe('Alice');
    expect(res.body.total).toBe(1);
  });

  it('PATCH /api/contacts/:id updates a contact', async () => {
    const company = await createCompany();
    const created = await request(app)
      .post('/api/contacts')
      .set(authHeaders())
      .send({ companyId: company.id, firstName: 'Jane' });

    const res = await request(app)
      .patch(`/api/contacts/${created.body.id}`)
      .set(authHeaders())
      .send({ firstName: 'Janet', title: 'Director' });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Janet');
    expect(res.body.title).toBe('Director');
  });

  it('DELETE /api/contacts/:id deletes a contact', async () => {
    const company = await createCompany();
    const created = await request(app)
      .post('/api/contacts')
      .set(authHeaders())
      .send({ companyId: company.id, firstName: 'ToDelete' });

    const res = await request(app)
      .delete(`/api/contacts/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/contacts/${created.body.id}`)
      .set(authHeaders());

    expect(getRes.status).toBe(404);
  });
});
