import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Leads from './pages/Leads.js';
import LeadDetail from './pages/LeadDetail.js';
import Pipelines from './pages/Pipelines.js';
import DealDetail from './pages/DealDetail.js';
import Settings from './pages/Settings.js';

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
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
