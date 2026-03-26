import { useEffect, useState } from 'react';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import type { BadgeVariant } from '../components/ui/Badge.js';

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string;
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  createdAt: string;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_VARIANTS: Record<string, BadgeVariant> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  scrape_started: 'amber',
  scrape_completed: 'green',
  activity_logged: 'purple',
  stage_changed: 'blue',
};

const ADMIN_ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'scrape_started',
  'scrape_completed',
  'activity_logged',
  'stage_changed',
];

const ENTITY_OPTIONS = ['company', 'contact', 'deal', 'invoice', 'activity'];

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function renderChanges(changes: AuditEntry['changes']) {
  if (!changes) return <span className="text-slate-400 text-xs">No details</span>;

  const { before, after } = changes;
  if (!before && !after) return <span className="text-slate-400 text-xs">No details</span>;

  if (!before && after) {
    return (
      <div className="text-xs space-y-1">
        <p className="text-emerald-600 font-bold uppercase tracking-wider">Created with:</p>
        <pre className="bg-slate-800 text-emerald-400 rounded p-2 overflow-x-auto text-xs max-h-40">
          {JSON.stringify(after, null, 2)}
        </pre>
      </div>
    );
  }

  if (before && !after) {
    return (
      <div className="text-xs space-y-1">
        <p className="text-red-500 font-bold uppercase tracking-wider">Deleted record:</p>
        <pre className="bg-slate-800 text-red-400 rounded p-2 overflow-x-auto text-xs max-h-40">
          {JSON.stringify(before, null, 2)}
        </pre>
      </div>
    );
  }

  if (before && after) {
    const changedKeys = new Set(
      [...Object.keys(before), ...Object.keys(after)].filter(
        (k) =>
          JSON.stringify((before as Record<string, unknown>)[k]) !==
          JSON.stringify((after as Record<string, unknown>)[k]),
      ),
    );

    if (changedKeys.size === 0) return <span className="text-slate-400 text-xs">No fields changed</span>;

    return (
      <div className="text-xs space-y-1.5">
        {Array.from(changedKeys).map((key) => (
          <div key={key} className="flex items-start gap-2">
            <span className="font-black text-slate-400 uppercase tracking-wider min-w-[80px]">{key}:</span>
            <span className="text-red-400 line-through">
              {JSON.stringify((before as Record<string, unknown>)[key]) ?? 'null'}
            </span>
            <span className="text-slate-500">&rarr;</span>
            <span className="text-emerald-400">
              {JSON.stringify((after as Record<string, unknown>)[key]) ?? 'null'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function AuditLog() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Filters (admin only)
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entity', entityFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);

    api<AuditResponse>(`/api/audit?${params.toString()}`)
      .then((res) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [actionFilter, entityFilter, fromFilter, toFilter, page]);

  const totalPages = Math.ceil(total / limit);

  function clearFilters() {
    setActionFilter('');
    setEntityFilter('');
    setFromFilter('');
    setToFilter('');
    setPage(1);
  }

  const hasFilters = actionFilter || entityFilter || fromFilter || toFilter;

  return (
    <div>
      <TopBar
        title="Audit Log"
        subtitle={isAdmin ? `${total} entries — full platform history` : `${total} entries — scrape activity`}
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="p-8 space-y-6">
          {/* Header bar */}
          <div className="bg-[#e7eeff] p-1 overflow-hidden">
            <div className="bg-slate-900 p-6 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                <h4 className="text-white font-black uppercase tracking-widest text-sm">
                  {isAdmin ? 'Platform Activity' : 'Scrape Activity'}
                </h4>
              </div>
              {!isAdmin && (
                <span className="text-slate-400 text-xs uppercase tracking-wider font-bold">
                  Showing scrape logs only
                </span>
              )}
            </div>
          </div>

          {/* Admin filters */}
          {isAdmin && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 text-sm text-slate-900 px-3 py-2 focus:outline-none focus:border-orange-500 min-w-[140px]"
                >
                  <option value="">All Actions</option>
                  {ADMIN_ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">Entity</label>
                <select
                  value={entityFilter}
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 text-sm text-slate-900 px-3 py-2 focus:outline-none focus:border-orange-500 min-w-[140px]"
                >
                  <option value="">All Entities</option>
                  {ENTITY_OPTIONS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">From</label>
                <input
                  type="date"
                  value={fromFilter}
                  onChange={(e) => { setFromFilter(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 text-sm text-slate-900 px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">To</label>
                <input
                  type="date"
                  value={toFilter}
                  onChange={(e) => { setToFilter(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 text-sm text-slate-900 px-3 py-2 focus:outline-none focus:border-orange-500"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-black uppercase tracking-widest text-orange-700 hover:underline self-end pb-2"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Timestamp
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Action
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Entity
                  </th>
                  {isAdmin && (
                    <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                      Details
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">history</span>
                        <p className="text-sm text-slate-500">No audit log entries found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-[#f0f3ff] transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (isAdmin) setExpandedId(expandedId === entry.id ? null : entry.id);
                      }}
                    >
                      <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-bold text-slate-900">{entry.userName || 'System'}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          label={entry.action}
                          variant={ACTION_VARIANTS[entry.action] ?? 'gray'}
                        />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700 capitalize">
                        {entry.entity}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 max-w-xs">
                          {expandedId === entry.id ? (
                            <div className="py-1">{renderChanges(entry.changes)}</div>
                          ) : (
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                              Click to expand
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-label uppercase tracking-wider text-slate-500">
                Page {page} of {totalPages} &nbsp;·&nbsp; {total} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-4 py-2 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-4 py-2 disabled:opacity-30 hover:bg-slate-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
