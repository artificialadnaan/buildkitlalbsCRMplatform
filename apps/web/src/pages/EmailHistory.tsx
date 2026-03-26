import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import { api } from '../lib/api.js';
import type { BadgeVariant } from '../components/ui/Badge.js';

interface EmailSendRow {
  id: string;
  subject: string | null;
  status: 'queued' | 'sent' | 'failed';
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  dealId: string | null;
  dealTitle: string | null;
  contactId: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  sentBy: string;
}

interface EmailSendsResponse {
  data: EmailSendRow[];
  total: number;
  page: number;
  limit: number;
}

const statusVariant: Record<string, BadgeVariant> = {
  sent: 'green',
  queued: 'amber',
  failed: 'red',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export default function EmailHistory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmailSendRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    api<EmailSendsResponse>(`/api/email-sends?${params.toString()}`)
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <TopBar title="Email History" subtitle={`${total} emails`} />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="p-8 space-y-6">
          {/* Header bar */}
          <div className="bg-[#e7eeff] p-1 overflow-hidden">
            <div className="bg-slate-900 p-6 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full" />
                <h4 className="text-white font-black uppercase tracking-widest text-sm">
                  All Email Sends
                </h4>
              </div>
              <p className="text-slate-400 text-xs">{total} total records</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Subject
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Recipient
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Sent At
                  </th>
                  <th className="text-left text-xs font-black uppercase tracking-wider text-slate-400 px-5 py-3">
                    Deal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">mail</span>
                        <p className="text-sm text-slate-500">No emails sent yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-[#f0f3ff] transition-colors ${row.dealId ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (row.dealId) navigate(`/deals/${row.dealId}`);
                      }}
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[280px]">
                          {row.subject || <span className="text-slate-400 font-normal">(no subject)</span>}
                        </p>
                        {row.errorMessage && (
                          <p className="text-xs text-red-600 mt-0.5 truncate max-w-[280px]">{row.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.contactFirstName ? (
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {row.contactFirstName} {row.contactLastName ?? ''}
                            </p>
                            {row.contactEmail && (
                              <p className="text-xs text-slate-500">{row.contactEmail}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge label={row.status} variant={statusVariant[row.status] ?? 'gray'} />
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {row.sentAt ? formatDate(row.sentAt) : (
                          <span className="text-slate-400 text-xs">Not sent yet</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {row.dealTitle ? (
                          <span className="text-sm font-bold text-orange-700 hover:underline">
                            {row.dealTitle}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-label uppercase tracking-wider text-slate-500">
                Page {page} of {totalPages} &nbsp;·&nbsp; {total} emails
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
