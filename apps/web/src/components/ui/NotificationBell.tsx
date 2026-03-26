import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
}

interface UnreadCountResponse {
  count: number;
}

const entityPaths: Record<string, string> = {
  company: '/leads',
  contact: '/leads',
  deal: '/deals',
  project: '/projects',
  invoice: '/invoices',
};

const typeIcons: Record<string, string> = {
  deal: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  project: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  contact: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  company: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  default: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Poll unread count every 30 seconds
  useEffect(() => {
    function fetchCount() {
      api<UnreadCountResponse>('/api/notifications/unread-count')
        .then((res) => setUnreadCount(res.count ?? 0))
        .catch(() => {});
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notification list when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoadingList(true);
    api<{ data?: Notification[]; notifications?: Notification[] }>('/api/notifications?limit=10')
      .then((res) => setNotifications(res.data ?? res.notifications ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingList(false));
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleNotificationClick(n: Notification) {
    // Mark as read
    api(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
    );
    setUnreadCount((c) => Math.max(0, c - (n.read ? 0 : 1)));

    // Navigate to entity
    if (n.entityType && n.entityId) {
      const basePath = entityPaths[n.entityType] ?? null;
      if (basePath) {
        navigate(`${basePath}/${n.entityId}`);
        setOpen(false);
      }
    }
  }

  function handleMarkAllRead() {
    api('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  const iconPath = (type: string) => typeIcons[type] ?? typeIcons.default;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons.default} />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#1F4D78]" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'bg-white'}`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${!n.read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath(n.type)} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <button
              onClick={() => { navigate('/notifications'); setOpen(false); }}
              className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
