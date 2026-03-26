import { Routes, Route } from 'react-router-dom';

function MagicLinkRequest() { return <div>Enter your email</div>; }
function MagicLinkSent() { return <div>Check your email</div>; }
function ProjectStatus() { return <div>Project Status</div>; }
function Messages() { return <div>Messages</div>; }
function Files() { return <div>Files</div>; }
function Invoices() { return <div>Invoices</div>; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<MagicLinkRequest />} />
      <Route path="/login/sent" element={<MagicLinkSent />} />
      <Route path="/" element={<ProjectStatus />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/files" element={<Files />} />
      <Route path="/invoices" element={<Invoices />} />
    </Routes>
  );
}
