import { useState, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.js';
import Sidebar from './Sidebar.js';
import CommandPalette from '../ui/CommandPalette.js';

const COLLAPSED_KEY = 'sidebar-collapsed';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9ff]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f9f9ff] font-body">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-3 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg md:hidden"
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      <main className={`min-h-screen transition-all duration-200 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <Outlet />
      </main>

      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* FAB - New Lead */}
      <button
        onClick={() => navigate('/leads')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-orange-700 to-orange-500 text-white rounded shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
        <span className="absolute right-full mr-4 px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity rounded-sm">
          New Project Lead
        </span>
      </button>
    </div>
  );
}
