import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth.js';
import Sidebar from './Sidebar.js';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
