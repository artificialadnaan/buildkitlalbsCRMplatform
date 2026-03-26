import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import DataTable from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';
import { api } from '../lib/api.js';

interface Sequence {
  id: string;
  name: string;
  pipelineType: 'local' | 'construction';
  stepCount: number;
  createdAt: string;
}

export default function EmailSequences() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ data: Sequence[] }>('/api/email-sequences').then(r => setSequences(r.data));
  }, []);

  async function deleteSequence(id: string) {
    if (!confirm('Delete this sequence and all its steps?')) return;
    await api(`/api/email-sequences/${id}`, { method: 'DELETE' });
    setSequences(prev => prev.filter(s => s.id !== id));
  }

  const columns = [
    { key: 'name', label: 'Sequence Name' },
    {
      key: 'pipelineType',
      label: 'Pipeline',
      render: (row: Sequence) => (
        <Badge
          label={row.pipelineType === 'construction' ? 'Construction' : 'Local'}
          variant={row.pipelineType === 'construction' ? 'gray' : 'blue'}
        />
      ),
    },
    {
      key: 'stepCount',
      label: 'Steps',
      render: (row: Sequence) => `${row.stepCount} step${row.stepCount !== 1 ? 's' : ''}`,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row: Sequence) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Sequence) => (
        <button
          onClick={(e) => { e.stopPropagation(); deleteSequence(row.id); }}
          className="text-red-500 hover:text-red-400 text-xs"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <TopBar
        title="Email Sequences"
        subtitle="Automated multi-step email outreach"
        actions={
          <button
            onClick={() => navigate('/email/sequences/new')}
            className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500"
          >
            + New Sequence
          </button>
        }
      />
      <DataTable columns={columns} data={sequences} onRowClick={row => navigate(`/email/sequences/${row.id}`)} />
    </div>
  );
}
