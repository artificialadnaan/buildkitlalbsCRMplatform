import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, companies, contacts, portalUsers, projects, files, deals, pipelines, pipelineStages } from '@buildkit/shared';
import { createSession } from '../src/lib/redis.js';
import { cleanPortalDb, portalSessionHeader } from './setup.js';

// Mock R2 client
vi.mock('../src/lib/r2.js', () => ({
  getUploadUrl: vi.fn().mockResolvedValue('https://r2.example.com/upload?signed=true'),
  getDownloadUrl: vi.fn().mockResolvedValue('https://r2.example.com/download?signed=true'),
  generateR2Key: vi.fn().mockReturnValue('projects/test/files/123-test.pdf'),
  getMaxFileSize: vi.fn().mockReturnValue(50 * 1024 * 1024),
}));

const app = createApp();

describe('Portal Files API', () => {
  let sessionId: string;
  let projectId: string;
  let companyId: string;

  beforeEach(async () => {
    await cleanPortalDb();

    const [company] = await db.insert(companies).values({ name: 'Client Co', type: 'local' }).returning();
    companyId = company.id;
    const [contact] = await db.insert(contacts).values({
      companyId, firstName: 'Jane', email: 'jane@client.com',
    }).returning();
    const [portalUser] = await db.insert(portalUsers).values({
      contactId: contact.id, companyId, email: 'jane@client.com',
    }).returning();

    const [pipeline] = await db.insert(pipelines).values({ name: 'Test' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId, pipelineId: pipeline.id, stageId: stage.id, title: 'Deal', status: 'won',
    }).returning();
    const [project] = await db.insert(projects).values({
      dealId: deal.id, companyId, name: 'Project', type: 'website', status: 'active',
    }).returning();
    projectId = project.id;

    // Seed a file
    await db.insert(files).values({
      projectId,
      uploadedBy: contact.id,
      filename: 'mockup.png',
      r2Key: 'projects/test/files/mockup.png',
      sizeBytes: 1024000,
      mimeType: 'image/png',
      requiresApproval: true,
    });

    sessionId = 'test-session-files-789';
    await createSession(sessionId, {
      portalUserId: portalUser.id,
      contactId: contact.id,
      companyId,
      email: 'jane@client.com',
    });
  });

  it('GET /portal/files/:projectId returns files with download URLs', async () => {
    const res = await request(app)
      .get(`/portal/files/${projectId}`)
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].filename).toBe('mockup.png');
    expect(res.body[0].downloadUrl).toContain('https://');
  });

  it('POST /portal/files/:projectId/upload-url returns signed URL', async () => {
    const res = await request(app)
      .post(`/portal/files/${projectId}/upload-url`)
      .set(portalSessionHeader(sessionId))
      .send({
        filename: 'design-v2.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048000,
      });

    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toContain('https://');
    expect(res.body.file.filename).toBe('design-v2.pdf');
  });

  it('POST /portal/files/:projectId/upload-url rejects oversized files', async () => {
    const res = await request(app)
      .post(`/portal/files/${projectId}/upload-url`)
      .set(portalSessionHeader(sessionId))
      .send({
        filename: 'huge.zip',
        contentType: 'application/zip',
        sizeBytes: 100 * 1024 * 1024, // 100MB
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('50MB');
  });

  it('GET /portal/files/:projectId returns 404 for other company project', async () => {
    const [otherCompany] = await db.insert(companies).values({ name: 'Other', type: 'construction' }).returning();
    const [pipeline] = await db.insert(pipelines).values({ name: 'Oth' }).returning();
    const [stage] = await db.insert(pipelineStages).values({ pipelineId: pipeline.id, name: 'Won', position: 1 }).returning();
    const [deal] = await db.insert(deals).values({
      companyId: otherCompany.id, pipelineId: pipeline.id, stageId: stage.id, title: 'Other', status: 'won',
    }).returning();
    const [otherProject] = await db.insert(projects).values({
      dealId: deal.id, companyId: otherCompany.id, name: 'Other', type: 'software', status: 'active',
    }).returning();

    const res = await request(app)
      .get(`/portal/files/${otherProject.id}`)
      .set(portalSessionHeader(sessionId));

    expect(res.status).toBe(404);
  });
});
