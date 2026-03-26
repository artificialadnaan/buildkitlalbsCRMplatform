import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import DataTable from '../components/ui/DataTable.js';
import Badge from '../components/ui/Badge.js';
import { api } from '../lib/api.js';

interface Template {
  id: string;
  name: string;
  subject: string;
  pipelineType: 'local' | 'construction';
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('pipelineType', typeFilter);
    api<{ data: Template[] }>(`/api/email-templates?${params}`).then(r => setTemplates(r.data));
  }, [typeFilter]);

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    await api(`/api/email-templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  const columns = [
    { key: 'name', label: 'Template Name' },
    { key: 'subject', label: 'Subject Line' },
    {
      key: 'pipelineType',
      label: 'Pipeline',
      render: (row: Template) => (
        <Badge
          label={row.pipelineType === 'construction' ? 'Construction' : 'Local Business'}
          variant={row.pipelineType === 'construction' ? 'purple' : 'blue'}
        />
      ),
    },
    {
      key: 'updatedAt',
      label: 'Last Modified',
      render: (row: Template) => new Date(row.updatedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Template) => (
        <button
          onClick={(e) => { e.stopPropagation(); deleteTemplate(row.id); }}
          className="text-red-400 hover:text-red-600 text-xs transition-colors"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div>
      <TopBar
        title="Email Templates"
        subtitle="Create emails that sound like you, not a robot"
        actions={
          <button
            onClick={() => navigate('/email/templates/new')}
            className="btn-primary"
          >
            + New Template
          </button>
        }
      />

      <div className="p-8">
        <div className="flex gap-3 mb-5">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Pipelines</option>
            <option value="local">Local Business</option>
            <option value="construction">Construction</option>
          </select>
        </div>

        <DataTable columns={columns} data={templates} onRowClick={row => navigate(`/email/templates/${row.id}`)} />
      </div>
    </div>
  );
}
