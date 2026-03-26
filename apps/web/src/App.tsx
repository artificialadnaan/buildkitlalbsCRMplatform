import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Leads from './pages/Leads.js';
import LeadDetail from './pages/LeadDetail.js';
import Pipelines from './pages/Pipelines.js';
import DealDetail from './pages/DealDetail.js';
import Settings from './pages/Settings.js';
<<<<<<< HEAD
import Invoices from './pages/Invoices.js';
import InvoiceDetail from './pages/InvoiceDetail.js';
=======
import EmailTemplates from './pages/EmailTemplates.js';
import EmailTemplateEditor from './pages/EmailTemplateEditor.js';
import EmailSequences from './pages/EmailSequences.js';
import EmailSequenceBuilder from './pages/EmailSequenceBuilder.js';
import Scraper from './pages/Scraper.js';
import Invoices from './pages/Invoices.js';
import InvoiceDetail from './pages/InvoiceDetail.js';
import Projects from './pages/Projects.js';
import ProjectDetail from './pages/ProjectDetail.js';
import TimeTracking from './pages/TimeTracking.js';
>>>>>>> feat/plan5-portal

function AuthCallback() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-500">Signing in...</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<LeadDetail />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/deals/:id" element={<DealDetail />} />
<<<<<<< HEAD
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
=======
        <Route path="/email/templates" element={<EmailTemplates />} />
        <Route path="/email/templates/new" element={<EmailTemplateEditor />} />
        <Route path="/email/templates/:id" element={<EmailTemplateEditor />} />
        <Route path="/email/sequences" element={<EmailSequences />} />
        <Route path="/email/sequences/new" element={<EmailSequenceBuilder />} />
        <Route path="/email/sequences/:id" element={<EmailSequenceBuilder />} />
        <Route path="/scraper" element={<Scraper />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/time" element={<TimeTracking />} />
>>>>>>> feat/plan5-portal
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
