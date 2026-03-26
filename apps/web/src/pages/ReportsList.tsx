import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import Badge, { type BadgeVariant } from '../components/ui/Badge.js';
import Modal from '../components/ui/Modal.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface Report {
  id: string;
  title: string;
  type: string;
  projectName: string | null;
  generatedAt: string;
  downloadUrl: string | null;
}

interface Project {
  id: string;
  name: string;
}

const typeVariant: Record<string, BadgeVariant> = {
  invoice: 'blue',
  proposal: 'purple',
  audit: 'amber',
  roi: 'green',
  sales: 'gray',
};

const REPORT_TYPES = ['invoice', 'proposal', 'audit', 'roi', 'sales'];

export default function ReportsList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ projectId: '', type: 'sales' });

  useEffect(() => {
    Promise.all([
      api<Report[]>('/api/reports'),
      api<Project[]>('/api/projects').catch(() => [] as Project[]),
    ])
      .then(([r, p]) => {
        setReports(r);
        setProjects(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const newReport = await api<Report>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(genForm),
      });
      setReports((prev) => [newReport, ...prev]);
      setShowGenerate(false);
      setGenForm({ projectId: '', type: 'sales' });
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setGenerating(false);
    }
  }

  const columns: Column<Report>[] = [
    { key: 'title', label: 'Title' },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <Badge label={row.type} variant={typeVariant[row.type] ?? 'gray'} />
      ),
    },
    {
      key: 'projectName',
      label: 'Project',
      render: (row) => row.projectName ?? '--',
    },
    {
      key: 'generatedAt',
      label: 'Generated',
      render: (row) => new Date(row.generatedAt).toLocaleDateString(),
    },
    {
      key: 'downloadUrl',
      label: 'Download',
      render: (row) =>
        row.downloadUrl ? (
          <a
            href={row.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:underline text-xs font-medium"
          >
            Download
          </a>
        ) : (
          <span className="text-gray-400 text-xs">--</span>
        ),
    },
  ];

  return (
    <div>
      <TopBar
        title="Reports"
        subtitle="Generated documents and analytics exports"
        actions={
          <button
            onClick={() => setShowGenerate(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Generate Report
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="p-6">
          <DataTable<Report>
            columns={columns}
            data={reports}
            emptyMessage="No reports yet — generate your first report"
            emptyAction={{ label: 'Generate Report', onClick: () => setShowGenerate(true) }}
          />
        </div>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Report">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={genForm.type}
              onChange={(e) => setGenForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project (optional)</label>
            <select
              value={genForm.projectId}
              onChange={(e) => setGenForm((p) => ({ ...p, projectId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- No project --</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setShowGenerate(false)}
              className="rounded-lg border border-border bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
