import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, portalUsers, contacts, companies } from '@buildkit/shared';
import { cleanPortalDb } from './setup.js';

// Mock nodemailer to prevent actual email sends during tests
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}));

const app = createApp();

describe('Portal Auth API', () => {
  let companyId: string;
  let contactId: string;

  beforeEach(async () => {
    await cleanPortalDb();
    const [company] = await db.insert(companies).values({ name: 'Test Co', type: 'local' }).returning();
    companyId = company.id;
    const [contact] = await db.insert(contacts).values({
      companyId, firstName: 'John', lastName: 'Doe', email: 'john@testco.com',
    }).returning();
    contactId = contact.id;
    await db.insert(portalUsers).values({
      contactId,
      companyId,
      email: 'john@testco.com',
    });
  });

  it('POST /portal/auth/request-link returns success for existing email', async () => {
    const res = await request(app)
      .post('/portal/auth/request-link')
      .send({ email: 'john@testco.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /portal/auth/request-link returns success for non-existent email (no leak)', async () => {
    const res = await request(app)
      .post('/portal/auth/request-link')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /portal/auth/request-link saves token to database', async () => {
    await request(app)
      .post('/portal/auth/request-link')
      .send({ email: 'john@testco.com' });

    const [user] = await db.select().from(portalUsers).where(
      require('drizzle-orm').eq(portalUsers.email, 'john@testco.com')
    ).limit(1);

    expect(user.magicLinkToken).toBeTruthy();
    expect(user.tokenExpiresAt).toBeTruthy();
    expect(new Date(user.tokenExpiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('POST /portal/auth/request-link returns 400 without email', async () => {
    const res = await request(app)
      .post('/portal/auth/request-link')
      .send({});

    expect(res.status).toBe(400);
  });

  it('GET /portal/auth/verify/:token redirects with session for valid token', async () => {
    // Manually set a token
    const token = 'test-valid-token-abc123';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.update(portalUsers)
      .set({ magicLinkToken: token, tokenExpiresAt: expiresAt })
      .where(require('drizzle-orm').eq(portalUsers.email, 'john@testco.com'));

    const res = await request(app)
      .get(`/portal/auth/verify/${token}`)
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('session=');
  });

  it('GET /portal/auth/verify/:token redirects with error for expired token', async () => {
    const token = 'expired-token-xyz';
    const expiresAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
    await db.update(portalUsers)
      .set({ magicLinkToken: token, tokenExpiresAt: expiresAt })
      .where(require('drizzle-orm').eq(portalUsers.email, 'john@testco.com'));

    const res = await request(app)
      .get(`/portal/auth/verify/${token}`)
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=invalid_or_expired');
  });
});
