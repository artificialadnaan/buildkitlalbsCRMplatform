import type { ReactNode } from 'react';
import NotificationBell from '../ui/NotificationBell.js';

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="w-full sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md flex justify-between items-center px-8 py-4 border-b border-orange-900/10">
      <div className="flex items-center space-x-6">
        <div>
          <h2 className="text-xl font-bold tracking-tighter text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {actions}
        <NotificationBell />
        <button className="p-2 text-slate-600 hover:bg-slate-200/50 transition-colors rounded-full">
          <span className="material-symbols-outlined">help</span>
        </button>
      </div>
    </header>
  );
}
