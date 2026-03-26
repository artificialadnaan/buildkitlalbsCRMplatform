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
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
  app.use(express.json());

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

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'buildkit-crm-api' });
  });

  app.use(errorHandler);

  return app;
}
