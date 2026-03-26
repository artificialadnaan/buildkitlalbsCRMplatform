import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth.js';
import { GridIcon } from '../ui/BuildKitLogo.js';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', fill: true },
  { to: '/leads', label: 'Leads', icon: 'person_search' },
  { to: '/pipelines', label: 'Pipelines', icon: 'view_kanban' },
  { to: '/scraper', label: 'Scraper', icon: 'travel_explore' },
  { to: '/email/templates', label: 'Templates', icon: 'description' },
  { to: '/email/sequences', label: 'Sequences', icon: 'account_tree' },
  { to: '/invoices', label: 'Invoices', icon: 'receipt_long' },
  { to: '/projects', label: 'Projects', icon: 'construction' },
  { to: '/time', label: 'Time', icon: 'timer' },
  { to: '/analytics', label: 'Analytics', icon: 'leaderboard' },
  { to: '/outreach', label: 'Outreach', icon: 'campaign' },
  { to: '/reports', label: 'Reports', icon: 'summarize' },
];

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen flex-col bg-slate-900 transition-all duration-200
          ${sidebarWidth}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="mb-8 px-4 pt-5 flex items-center space-x-3">
          <GridIcon size={collapsed ? 28 : 36} />
          {!collapsed && (
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-none">
                Build<span className="text-orange-400">Kit</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-label tracking-[0.15em] uppercase">
                Software + Web Dev
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 transition-all duration-200 ease-in-out ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-sm shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined text-xl"
                    style={isActive && item.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="font-semibold text-sm tracking-wide uppercase">
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden md:block border-t border-slate-800 px-3 py-2">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-sm px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-xl">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Bottom: Settings + User */}
        <div className="border-t border-slate-800 px-3 py-2 space-y-1">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            {!collapsed && <span className="font-semibold text-sm tracking-wide uppercase">Settings</span>}
          </NavLink>

          {user && (
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-100 uppercase tracking-wider truncate">{user.name}</p>
                  <button
                    onClick={logout}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
