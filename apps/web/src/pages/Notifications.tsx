import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import { api } from '../lib/api.js';

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
  total: number;
  page: number;
  limit: number;
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
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Filter = 'all' | 'unread';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (filter === 'unread') params.set('unread', 'true');

    api<NotificationsResponse>(`/api/notifications?${params.toString()}`)
      .then((res) => {
        setNotifications(res.notifications ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, page]);

  function handleMarkAllRead() {
    api('/api/notifications/read-all', { method: 'PATCH' }).catch(console.error);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleNotificationClick(n: Notification) {
    if (!n.read) {
      api(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(console.error);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
    }
    if (n.entityType && n.entityId) {
      const basePath = entityPaths[n.entityType] ?? null;
      if (basePath) navigate(`${basePath}/${n.entityId}`);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const iconPath = (type: string) => typeIcons[type] ?? typeIcons.default;

  return (
    <div>
      <TopBar
        title="Notifications"
        subtitle={`${total} total`}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Mark all as read
            </button>
          ) : undefined
        }
      />

      <div className="p-6">
        {/* Filter tabs */}
        <div className="mb-4 flex items-center gap-1 border-b border-gray-200">
          {(['all', 'unread'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                filter === f
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={typeIcons.default} />
            </svg>
            <p className="text-sm">No notifications to show</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  !n.read
                    ? 'border-l-4 border-l-blue-500 border-t-gray-200 border-r-gray-200 border-b-gray-200 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${!n.read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath(n.type)} />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <span className="flex-shrink-0 text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-gray-500">{n.body}</p>
                  )}
                  {n.entityType && (
                    <span className="mt-1.5 inline-block text-xs text-gray-400 capitalize">{n.entityType}</span>
                  )}
                </div>

                {!n.read && (
                  <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} notifications)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
