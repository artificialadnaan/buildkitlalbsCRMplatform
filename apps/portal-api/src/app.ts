import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import messagesRoutes from './routes/messages.js';
import filesRoutes from './routes/files.js';
import portalInvoicesRoutes from './routes/invoices.js';
import surveysRoutes from './routes/surveys.js';
import portalChangeRequestsRoutes from './routes/change-requests.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.PORTAL_FRONTEND_URL || 'http://localhost:5174',
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Routes
  app.use('/portal/auth', authRoutes);
  app.use('/portal/projects', projectsRoutes);
  app.use('/portal/messages', messagesRoutes);
  app.use('/portal/files', filesRoutes);
  app.use('/portal/invoices', portalInvoicesRoutes);
  app.use('/portal/surveys', surveysRoutes);
  app.use('/portal/change-requests', portalChangeRequestsRoutes);

  // Health check
  app.get('/portal/health', (req, res) => {
    res.json({ status: 'ok', service: 'buildkit-portal-api' });
  });

  return app;
}
