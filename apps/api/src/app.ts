import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
import contactsRoutes from './routes/contacts.js';
import pipelinesRoutes from './routes/pipelines.js';
import dealsRoutes from './routes/deals.js';
import activitiesRoutes from './routes/activities.js';
import dashboardRoutes from './routes/dashboard.js';
import emailTemplatesRoutes from './routes/email-templates.js';
import emailSequencesRoutes from './routes/email-sequences.js';
import emailSendsRoutes from './routes/email-sends.js';
import sequenceEnrollmentsRoutes from './routes/sequence-enrollments.js';
import projectsRoutes from './routes/projects.js';
import milestonesRoutes from './routes/milestones.js';
import tasksRoutes from './routes/tasks.js';
import timeEntriesRoutes from './routes/time-entries.js';
import scrapeRoutes from './routes/scrape.js';
import invoicesRoutes from './routes/invoices.js';
import invoicesStripeRoutes from './routes/invoices-stripe.js';
import filesRoutes from './routes/files.js';
import messagesRoutes from './routes/messages.js';
import usersRoutes from './routes/users.js';
import emailTrackingRoutes from './routes/email-tracking.js';
import analyticsRoutes from './routes/analytics.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import auditRoutes from './routes/audit.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/dist/queueAdapters/bullMQ.js';
import { ExpressAdapter } from '@bull-board/express';
import { createScrapeQueue, EMAIL_SEND_QUEUE, SEQUENCE_TICK_QUEUE, GMAIL_SYNC_QUEUE, getRedisConnection } from '@buildkit/shared';
import { Queue } from 'bullmq';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
  app.use(express.json());

  // Public tracking routes (no auth — hit by email clients)
  app.use('/t', emailTrackingRoutes);

  // Routes
  app.use('/auth', authRoutes);
  app.use('/api/companies', companiesRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/pipelines', pipelinesRoutes);
  app.use('/api/deals', dealsRoutes);
  app.use('/api/activities', activitiesRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/email-templates', emailTemplatesRoutes);
  app.use('/api/email-sequences', emailSequencesRoutes);
  app.use('/api/email-sends', emailSendsRoutes);
  app.use('/api/sequence-enrollments', sequenceEnrollmentsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/projects/:projectId/milestones', milestonesRoutes);
  app.use('/api/milestones/:milestoneId/tasks', tasksRoutes);
  app.use('/api/time-entries', timeEntriesRoutes);
  app.use('/api/scrape', scrapeRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/invoices', invoicesStripeRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/audit', auditRoutes);

  // Bull Board admin UI (only when Redis is available)
  if (process.env.REDIS_URL) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const redisConn = getRedisConnection();
    createBullBoard({
      queues: [
        new BullMQAdapter(createScrapeQueue()),
        new BullMQAdapter(new Queue(EMAIL_SEND_QUEUE, { connection: redisConn })),
        new BullMQAdapter(new Queue(SEQUENCE_TICK_QUEUE, { connection: redisConn })),
        new BullMQAdapter(new Queue(GMAIL_SYNC_QUEUE, { connection: redisConn })),
      ],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'buildkit-crm-api' });
  });

  app.use(errorHandler);

  return app;
}
