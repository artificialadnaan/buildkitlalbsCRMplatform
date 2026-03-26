import { NavLink } from 'react-router-dom';
import { usePortalAuth } from '../../lib/auth.js';

const navItems = [
  { to: '/', label: 'Project', icon: '\uD83D\uDCCB' },
  { to: '/messages', label: 'Messages', icon: '\uD83D\uDCAC' },
  { to: '/files', label: 'Files', icon: '\uD83D\uDCC1' },
  { to: '/invoices', label: 'Invoices', icon: '\uD83D\uDCB0' },
  { to: '/surveys', label: 'Surveys', icon: '\u2B50' },
  { to: '/changes', label: 'Changes', icon: '\uD83D\uDD04' },
];

export default function PortalSidebar() {
  const { activeProject, logout } = usePortalAuth();

  return (
    <aside className="w-52 bg-sidebar border-r border-border flex flex-col h-screen fixed left-0 top-0">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" width={28} height={28} className="shrink-0">
          <rect x="0" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.3}/>
          <rect x="13" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.35}/>
          <rect x="26" y="0" width="10" height="10" rx="2" fill="#d97706" opacity={0.5}/>
          <rect x="0" y="13" width="10" height="10" rx="2" fill="#d97706" opacity={0.35}/>
          <rect x="13" y="13" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.6}/>
          <rect x="26" y="13" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.8}/>
          <rect x="0" y="26" width="10" height="10" rx="2" fill="#d97706" opacity={0.5}/>
          <rect x="13" y="26" width="10" height="10" rx="2" fill="#f59e0b" opacity={0.8}/>
          <rect x="26" y="26" width="10" height="10" rx="2" fill="#f97316" opacity={1}/>
        </svg>
        <div>
          <h1 className="text-sm font-extrabold text-gray-200 tracking-tight">
            Build<span className="text-orange-400">Kit</span>
          </h1>
          <p className="text-[10px] text-gray-500 tracking-wider uppercase">Client Portal</p>
        </div>
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
