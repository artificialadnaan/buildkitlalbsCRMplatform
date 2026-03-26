import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import TopBar from '../components/layout/TopBar.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';
import Modal from '../components/ui/Modal.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import { useToast } from '../components/ui/Toast.js';
import ContextualActionButton from '../components/ui/ContextualActionButton.js';

interface Company {
  id: string;
  name: string;
  type: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string;
  industry: string | null;
  googleRating: string | null;
  score: number;
  websiteAudit: { score: number } | null;
}

interface CompanyResponse {
  data: Company[];
  total: number;
  page: number;
  limit: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

const typeVariants: Record<string, 'blue' | 'purple'> = {
  local: 'blue',
  construction: 'purple',
};

const sourceVariants: Record<string, 'amber' | 'green'> = {
  scraped: 'amber',
  manual: 'green',
};

function ScoreIndicator({ score }: { score: number }) {
  let color = 'bg-gray-400';
  if (score >= 70) color = 'bg-emerald-500';
  else if (score >= 40) color = 'bg-amber-500';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span className="text-sm font-medium text-gray-700">{score}</span>
    </span>
  );
}

function WebsiteScoreBadge({ audit }: { audit: { score: number } | null }) {
  if (!audit) {
    return <span className="text-sm text-gray-400">—</span>;
  }
  const { score } = audit;
  let classes = 'bg-red-100 text-red-700 border-red-200';
  if (score > 60) classes = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (score > 30) classes = 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {score}
    </span>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortByScore, setSortByScore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '', type: 'local' as string, phone: '', website: '',
    address: '', city: '', state: 'TX', zip: '', industry: '',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);
  const { showError, showSuccess, ToastComponent } = useToast();

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function handleCreateLead() {
    if (!newLead.name.trim()) return;
    setSaving(true);
    try {
      await api('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ ...newLead, source: 'manual' }),
      });
      setShowCreate(false);
      setNewLead({ name: '', type: 'local', phone: '', website: '', address: '', city: '', state: 'TX', zip: '', industry: '' });
      showSuccess('Lead created successfully');
      await loadCompanies();
    } catch (err) {
      console.error('Failed to create lead:', err);
      showError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setSaving(false);
    }
  }

  async function loadCompanies() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    if (sortByScore) params.set('sort', 'score');
    const qs = params.toString();

    try {
      const res = await api<CompanyResponse>(`/api/companies${qs ? '?' + qs : ''}`);
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadCompanies().finally(() => setLoading(false));
  }, [search, typeFilter, sortByScore]);

  async function handleRescore() {
    setRescoring(true);
    try {
      const res = await api<{ updated: number; total: number }>('/api/companies/rescore', { method: 'POST' });
      showSuccess(`Rescored ${res.updated} of ${res.total} companies`);
      await loadCompanies();
    } catch (err) {
      console.error('Failed to rescore:', err);
      showError(err instanceof Error ? err.message : 'Failed to rescore');
    } finally {
      setRescoring(false);
    }
  }

  // Bulk actions
  async function loadUsers() {
    if (usersList.length > 0) return;
    try {
      const data = await api<UserItem[]>('/api/users');
      setUsersList(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await api(`/api/companies/${id}`, { method: 'DELETE' });
      }
      showSuccess(`Deleted ${ids.length} companies`);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      await loadCompanies();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      showError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleExportCsv() {
    const selected = companies.filter((c) => selectedIds.has(c.id));
    const headers = ['Name', 'Type', 'Phone', 'City', 'State', 'Industry', 'Source', 'Score', 'Website'];
    const rows = selected.map((c) => [
      c.name,
      c.type,
      c.phone ?? '',
      c.city ?? '',
      c.state ?? '',
      c.industry ?? '',
      c.source,
      String(c.score),
      c.website ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showSuccess(`Exported ${selected.length} leads to CSV`);
  }

  const columns: Column<Company>[] = [
    {
      key: 'score',
      label: 'Score',
      render: (row) => <ScoreIndicator score={row.score} />,
    },
    { key: 'name', label: 'Company Name' },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <Badge label={row.type} variant={typeVariants[row.type] ?? 'gray'} />
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'city',
      label: 'Location',
      render: (row) =>
        row.city && row.state ? `${row.city}, ${row.state}` : row.city ?? row.state ?? '--',
    },
    {
      key: 'source',
      label: 'Source',
      render: (row) => (
        <Badge label={row.source} variant={sourceVariants[row.source] ?? 'gray'} />
      ),
    },
    {
      key: 'websiteAudit',
      label: 'Web Score',
      render: (row) => <WebsiteScoreBadge audit={row.websiteAudit} />,
    },
    {
      key: 'id',
      label: 'Action',
      render: (row) => <ContextualActionButton company={row} />,
    },
  ];

  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <TopBar
        title="Leads"
        subtitle={`${companies.length} companies`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const token = localStorage.getItem('token');
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/export/companies`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((res) => res.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `companies-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  });
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={handleRescore}
              disabled={rescoring}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {rescoring ? 'Rescoring...' : 'Rescore All'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              + New Lead
            </button>
          </div>
        }
      />

      {loading ? <LoadingSpinner /> : <div className="p-6">
        {/* Filters */}
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="local">Local</option>
            <option value="construction">Construction</option>
          </select>
          <button
            onClick={() => setSortByScore((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              sortByScore
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-border bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Sort by Score
          </button>
        </div>

        <DataTable<Company>
          columns={columns}
          data={companies}
          onRowClick={(row) => navigate(`/leads/${row.id}`)}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-white px-5 py-3 shadow-lg">
            <span className="text-sm font-medium text-gray-700">
              {selectedIds.size} selected
            </span>
            <div className="h-5 w-px bg-gray-200" />
            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    showSuccess(`Assigned ${selectedIds.size} leads to user`);
                    // Future: call assign API
                    e.target.value = '';
                  }
                }}
                onFocus={loadUsers}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="" disabled>Assign to...</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete Selected
              </button>
            )}
            <button
              onClick={handleExportCsv}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => showSuccess('Sequence enrollment coming soon')}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Enroll in Sequence
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>}

      {/* Create Lead Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New Lead">
        <div className="space-y-3">
          <input
            placeholder="Company Name *"
            value={newLead.name}
            onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={newLead.type}
            onChange={e => setNewLead(p => ({ ...p, type: e.target.value }))}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="local">Local Business</option>
            <option value="construction">Construction</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Phone"
              value={newLead.phone}
              onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Website"
              value={newLead.website}
              onChange={e => setNewLead(p => ({ ...p, website: e.target.value }))}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            placeholder="Address"
            value={newLead.address}
            onChange={e => setNewLead(p => ({ ...p, address: e.target.value }))}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="City"
              value={newLead.city}
              onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="State"
              value={newLead.state}
              onChange={e => setNewLead(p => ({ ...p, state: e.target.value }))}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Zip"
              value={newLead.zip}
              onChange={e => setNewLead(p => ({ ...p, zip: e.target.value }))}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            placeholder="Industry"
            value={newLead.industry}
            onChange={e => setNewLead(p => ({ ...p, industry: e.target.value }))}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleCreateLead}
            disabled={saving || !newLead.name.trim()}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Bulk Delete">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{selectedIds.size}</strong> selected companies? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-border bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {bulkDeleting ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      </Modal>

      {ToastComponent}
    </div>
  );
}
