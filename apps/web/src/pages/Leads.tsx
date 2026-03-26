import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';
import Modal from '../components/ui/Modal.js';

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
}

interface CompanyResponse {
  data: Company[];
  total: number;
  page: number;
  limit: number;
}

const typeVariants: Record<string, 'blue' | 'purple'> = {
  local: 'blue',
  construction: 'purple',
};

const sourceVariants: Record<string, 'amber' | 'green'> = {
  scraped: 'amber',
  manual: 'green',
};

export default function Leads() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '', type: 'local' as string, phone: '', website: '',
    address: '', city: '', state: 'TX', zip: '', industry: '',
  });
  const [saving, setSaving] = useState(false);

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
      // Refresh list
      const res = await api<CompanyResponse>('/api/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to create lead:', err);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    const qs = params.toString();

    api<CompanyResponse>(`/api/companies${qs ? '?' + qs : ''}`)
      .then((res) => setCompanies(res.data))
      .catch(console.error);
  }, [search, typeFilter]);

  const columns: Column<Company>[] = [
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
  ];

  return (
    <div>
      <TopBar
        title="Leads"
        subtitle={`${companies.length} companies`}
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            + New Lead
          </button>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="local">Local</option>
            <option value="construction">Construction</option>
          </select>
        </div>

        <DataTable<Company>
          columns={columns}
          data={companies}
          onRowClick={(row) => navigate(`/leads/${row.id}`)}
        />
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add New Lead">
        <div className="space-y-3">
          <input
            placeholder="Company Name *"
            value={newLead.name}
            onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={newLead.type}
            onChange={e => setNewLead(p => ({ ...p, type: e.target.value }))}
            className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="local">Local Business</option>
            <option value="construction">Construction</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Phone"
              value={newLead.phone}
              onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))}
              className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Website"
              value={newLead.website}
              onChange={e => setNewLead(p => ({ ...p, website: e.target.value }))}
              className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            placeholder="Address"
            value={newLead.address}
            onChange={e => setNewLead(p => ({ ...p, address: e.target.value }))}
            className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="City"
              value={newLead.city}
              onChange={e => setNewLead(p => ({ ...p, city: e.target.value }))}
              className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="State"
              value={newLead.state}
              onChange={e => setNewLead(p => ({ ...p, state: e.target.value }))}
              className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              placeholder="Zip"
              value={newLead.zip}
              onChange={e => setNewLead(p => ({ ...p, zip: e.target.value }))}
              className="rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            placeholder="Industry"
            value={newLead.industry}
            onChange={e => setNewLead(p => ({ ...p, industry: e.target.value }))}
            className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
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
    </div>
  );
}
