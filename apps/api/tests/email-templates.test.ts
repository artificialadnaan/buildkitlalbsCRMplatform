import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authHeaders, cleanDb } from './setup.js';

const app = createApp();

describe('Email Templates API', () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it('POST /api/email-templates creates a template', async () => {
    const res = await request(app)
      .post('/api/email-templates')
      .set(authHeaders())
      .send({
        name: 'Construction Touch 1',
        subject: 'Custom Software for {{company.name}}',
        bodyHtml: '<p>Hi {{contact.first_name}},</p><p>We build software for construction companies like {{company.name}}.</p>',
        pipelineType: 'construction',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Construction Touch 1');
    expect(res.body.subject).toContain('{{company.name}}');
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/email-templates returns list', async () => {
    await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Template A', subject: 'Sub A', bodyHtml: '<p>A</p>', pipelineType: 'local',
    });
    await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Template B', subject: 'Sub B', bodyHtml: '<p>B</p>', pipelineType: 'construction',
    });

    const res = await request(app).get('/api/email-templates').set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('GET /api/email-templates filters by pipelineType', async () => {
    await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Local', subject: 'S', bodyHtml: '<p>L</p>', pipelineType: 'local',
    });
    await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Construction', subject: 'S', bodyHtml: '<p>C</p>', pipelineType: 'construction',
    });

    const res = await request(app)
      .get('/api/email-templates?pipelineType=construction')
      .set(authHeaders());

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Construction');
  });

  it('GET /api/email-templates/:id returns a single template', async () => {
    const created = await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Test', subject: 'S', bodyHtml: '<p>Body</p>', pipelineType: 'local',
    });

    const res = await request(app)
      .get(`/api/email-templates/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test');
  });

  it('PATCH /api/email-templates/:id updates a template', async () => {
    const created = await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Old Name', subject: 'Old', bodyHtml: '<p>Old</p>', pipelineType: 'local',
    });

    const res = await request(app)
      .patch(`/api/email-templates/${created.body.id}`)
      .set(authHeaders())
      .send({ name: 'New Name', subject: 'New Subject' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.subject).toBe('New Subject');
  });

  it('DELETE /api/email-templates/:id deletes a template', async () => {
    const created = await request(app).post('/api/email-templates').set(authHeaders()).send({
      name: 'Delete Me', subject: 'S', bodyHtml: '<p>X</p>', pipelineType: 'local',
    });

    const res = await request(app)
      .delete(`/api/email-templates/${created.body.id}`)
      .set(authHeaders());

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/email-templates/${created.body.id}`)
      .set(authHeaders());

    expect(getRes.status).toBe(404);
  });

  it('POST /api/email-templates/preview resolves template variables', async () => {
    const res = await request(app)
      .post('/api/email-templates/preview')
      .set(authHeaders())
      .send({
        subject: 'Software for {{company.name}}',
        bodyHtml: '<p>Hi {{contact.first_name}}, we help {{company.name}}.</p>',
        variables: {
          'contact.first_name': 'John',
          'company.name': 'ABC Construction',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Software for ABC Construction');
    expect(res.body.bodyHtml).toContain('Hi John');
    expect(res.body.bodyHtml).toContain('ABC Construction');
  });
});
