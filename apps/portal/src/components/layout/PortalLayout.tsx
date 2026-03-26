import { Outlet, Navigate } from 'react-router-dom';
import { usePortalAuth } from '../../lib/auth.js';
import PortalSidebar from './PortalSidebar.js';

export default function PortalLayout() {
  const { authenticated, loading } = usePortalAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <PortalSidebar />
      <main className="flex-1 ml-52 p-6">
        <Outlet />
      </main>
    </div>
  );
}
