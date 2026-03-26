import { NavLink } from 'react-router-dom';
import { usePortalAuth } from '../../lib/auth.js';

const navItems = [
  { to: '/', label: 'Project', icon: '\uD83D\uDCCB' },
  { to: '/messages', label: 'Messages', icon: '\uD83D\uDCAC' },
  { to: '/files', label: 'Files', icon: '\uD83D\uDCC1' },
  { to: '/invoices', label: 'Invoices', icon: '\uD83D\uDCB0' },
];

export default function PortalSidebar() {
  const { activeProject, logout } = usePortalAuth();

  return (
    <aside className="w-52 bg-sidebar border-r border-border flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-sm font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
          BuildKit Labs
        </h1>
        <p className="text-xs text-gray-600 mt-1">Client Portal</p>
      </div>

      {activeProject && (
        <div className="px-4 py-3 border-b border-border">
          <div className="text-xs text-gray-500 uppercase">Project</div>
          <div className="text-sm text-gray-300 font-medium truncate">{activeProject.name}</div>
        </div>
      )}

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-r-md text-sm border-l-[3px] transition ${
                isActive
                  ? 'border-blue-500 bg-blue-500/10 text-gray-200'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <button onClick={logout} className="text-xs text-gray-600 hover:text-gray-400">
          Sign out
        </button>
      </div>
    </aside>
  );
}
