import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

interface TimelineResponse {
  data: TimelineEvent[];
  total: number;
  page: number;
  limit: number;
}

interface CompanyTimelineProps {
  companyId: string;
}

const typeColors: Record<string, string> = {
  email: 'bg-indigo-500',
  email_sent: 'bg-indigo-500',
  email_opened: 'bg-indigo-400',
  email_clicked: 'bg-indigo-600',
  call: 'bg-blue-500',
  note: 'bg-blue-400',
  meeting: 'bg-blue-600',
  activity: 'bg-blue-500',
  deal_created: 'bg-purple-500',
  stage_changed: 'bg-purple-400',
  deal_won: 'bg-emerald-500',
  deal_lost: 'bg-red-400',
  project_created: 'bg-orange-500',
  milestone_completed: 'bg-orange-400',
};

const typeIcons: Record<string, string> = {
  email: '✉',
  email_sent: '✉',
  email_opened: '✉',
  email_clicked: '✉',
  call: '📞',
  note: '📝',
  meeting: '📅',
  activity: '📋',
  deal_created: '💰',
  stage_changed: '💰',
  deal_won: '💰',
  deal_lost: '💰',
  project_created: '📁',
  milestone_completed: '📁',
};

function dotColor(type: string): string {
  return typeColors[type] ?? 'bg-gray-400';
}

function eventIcon(type: string): string {
  return typeIcons[type] ?? '•';
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CompanyTimeline({ companyId }: CompanyTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    api<TimelineResponse>(`/api/companies/${companyId}/timeline?page=1&limit=${limit}`)
      .then((res) => {
        setEvents(res.data);
        setTotal(res.total);
        setPage(1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await api<TimelineResponse>(
        `/api/companies/${companyId}/timeline?page=${nextPage}&limit=${limit}`
      );
      setEvents((prev) => [...prev, ...res.data]);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more timeline events:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = events.length < total;

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Activity Timeline</h2>
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Activity Timeline</h2>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm text-gray-500">No activity yet</p>
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Vertical timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div>
            {events.map((event) => (
              <div key={event.id} className="relative ml-4 pb-6 last:pb-0">
                {/* Dot */}
                <div
                  className={`absolute -left-7 top-1.5 h-3 w-3 rounded-full border-2 border-white ${dotColor(event.type)}`}
                />

                {/* Content */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-sm leading-none" aria-hidden="true">
                    {eventIcon(event.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="shrink-0 text-xs text-gray-400">{formatTimestamp(event.timestamp)}</p>
                    </div>
                    {event.description && (
                      <p className="mt-0.5 text-sm text-gray-500">{event.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-border bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
