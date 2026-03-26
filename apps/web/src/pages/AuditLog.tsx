import { useEffect, useState } from 'react';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import { api } from '../lib/api.js';

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

const actionVariants: Record<string, 'green' | 'blue' | 'red'> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
};

const entityPaths: Record<string, string> = {
  company: '/leads',
  contact: '/leads',
  deal: '/deals',
  invoice: '/invoices',
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (entityFilter) params.set('entity', entityFilter);

    api<AuditResponse>(`/api/audit?${params.toString()}`)
      .then((res) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityFilter, page]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function renderChanges(changes: AuditEntry['changes']) {
    if (!changes) return <span className="text-gray-400 text-xs">No change details</span>;

    const { before, after } = changes;
    if (!before && !after) return <span className="text-gray-400 text-xs">No change details</span>;

    // For creates, show the new values
    if (!before && after) {
      return (
        <div className="text-xs space-y-1">
          <p className="text-green-600 font-medium">Created with:</p>
          <pre className="bg-green-50 border border-green-200 rounded p-2 overflow-x-auto text-xs text-gray-700 max-h-40">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      );
    }

    // For deletes, show what was removed
    if (before && !after) {
      return (
        <div className="text-xs space-y-1">
          <p className="text-red-600 font-medium">Deleted record:</p>
          <pre className="bg-red-50 border border-red-200 rounded p-2 overflow-x-auto text-xs text-gray-700 max-h-40">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      );
    }

    // For updates, show diff
    if (before && after) {
      const changedKeys = new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ].filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k])));

      if (changedKeys.size === 0) return <span className="text-gray-400 text-xs">No fields changed</span>;

      return (
        <div className="text-xs space-y-1">
          {Array.from(changedKeys).map((key) => (
            <div key={key} className="flex items-start gap-2">
              <span className="font-medium text-gray-600 min-w-[80px]">{key}:</span>
              <span className="text-red-500 line-through">{JSON.stringify((before as Record<string, unknown>)[key]) ?? 'null'}</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="text-green-600">{JSON.stringify((after as Record<string, unknown>)[key]) ?? 'null'}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <TopBar title="Audit Log" subtitle={`${total} entries`} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="p-6">
          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
            >
              <option value="">All Entities</option>
              <option value="company">Company</option>
              <option value="contact">Contact</option>
              <option value="deal">Deal</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left text-xs uppercase text-gray-500 px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left text-xs uppercase text-gray-500 px-4 py-3 font-medium">User</th>
                  <th className="text-left text-xs uppercase text-gray-500 px-4 py-3 font-medium">Action</th>
                  <th className="text-left text-xs uppercase text-gray-500 px-4 py-3 font-medium">Entity</th>
                  <th className="text-left text-xs uppercase text-gray-500 px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      No audit log entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {entry.userName || 'System'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={entry.action}
                          variant={actionVariants[entry.action] ?? 'gray'}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                        {entry.entity}
                      </td>
                      <td className="px-4 py-3">
                        {expandedId === entry.id ? (
                          <div className="py-1">{renderChanges(entry.changes)}</div>
                        ) : (
                          <span className="text-xs text-gray-400">Click to expand</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} entries)
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
      )}
    </div>
  );
}
