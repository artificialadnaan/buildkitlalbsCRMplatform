import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';

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
      <TopBar title="Leads" subtitle={`${companies.length} companies`} />

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
    </div>
  );
}
