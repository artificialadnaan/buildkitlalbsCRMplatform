import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import DataTable from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';
import { api } from '../lib/api.js';

interface ProjectRow {
  id: string;
  name: string;
  type: 'website' | 'software';
  status: 'active' | 'on_hold' | 'completed';
  budget: number | null;
  companyName: string;
  assignedToName: string | null;
  createdAt: string;
}

const statusVariant: Record<string, string> = {
  active: 'green',
  on_hold: 'amber',
  completed: 'blue',
};

const statusLabel: Record<string, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
};

export default function Projects() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);

    api<{ data: ProjectRow[] }>(`/api/projects?${params}`).then(r => setProjects(r.data));
  }, [statusFilter]);

  const columns = [
    { key: 'name', label: 'Project' },
    {
      key: 'type',
      label: 'Type',
      render: (row: ProjectRow) => (
        <Badge
          label={row.type === 'software' ? 'Software' : 'Website'}
          variant={row.type === 'software' ? 'purple' : 'blue'}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ProjectRow) => (
        <Badge label={statusLabel[row.status]} variant={statusVariant[row.status]} />
      ),
    },
    {
      key: 'companyName',
      label: 'Client',
      render: (row: ProjectRow) => row.companyName || '---',
    },
    {
      key: 'assignedToName',
      label: 'Assigned To',
      render: (row: ProjectRow) => row.assignedToName || '---',
    },
    {
      key: 'budget',
      label: 'Budget',
      render: (row: ProjectRow) => row.budget != null ? `$${row.budget.toLocaleString()}` : '---',
    },
  ];

  return (
    <div>
      <TopBar
        title="Projects"
        actions={
          <button
            onClick={() => navigate('/projects/new')}
            className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500"
          >
            + New Project
          </button>
        }
      />

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <DataTable columns={columns} data={projects} onRowClick={row => navigate(`/projects/${row.id}`)} />
    </div>
  );
}
