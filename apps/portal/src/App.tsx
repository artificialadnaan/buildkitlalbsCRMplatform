import { Routes, Route } from 'react-router-dom';
import { PortalAuthProvider } from './lib/auth.js';
import PortalLayout from './components/layout/PortalLayout.js';
import MagicLinkRequest from './pages/MagicLinkRequest.js';
import MagicLinkSent from './pages/MagicLinkSent.js';
import ProjectStatus from './pages/ProjectStatus.js';
import Messages from './pages/Messages.js';
import Files from './pages/Files.js';
import PortalInvoices from './pages/Invoices.js';
import Surveys from './pages/Surveys.js';
import ChangeRequests from './pages/ChangeRequests.js';

export default function App() {
  return (
    <PortalAuthProvider>
      <Routes>
        <Route path="/login" element={<MagicLinkRequest />} />
        <Route path="/login/sent" element={<MagicLinkSent />} />
        <Route element={<PortalLayout />}>
          <Route path="/" element={<ProjectStatus />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/files" element={<Files />} />
          <Route path="/invoices" element={<PortalInvoices />} />
          <Route path="/surveys" element={<Surveys />} />
          <Route path="/changes" element={<ChangeRequests />} />
        </Route>
      </Routes>
    </PortalAuthProvider>
  );
}
