import { useEffect, useState } from 'react';
import TopBar from '../components/layout/TopBar.js';
import StatCard from '../components/ui/StatCard.js';
import Badge from '../components/ui/Badge.js';
import Modal from '../components/ui/Modal.js';
import TimeEntryForm from '../components/ui/TimeEntryForm.js';
import { api } from '../lib/api.js';

interface TimeSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  byUser: { userId: string; userName: string; totalMinutes: number; billableMinutes: number }[];
  byProject: { projectId: string; projectName: string; totalMinutes: number; billableMinutes: number }[];
}

interface TimeEntry {
  id: string;
  projectId: string;
  description: string | null;
  durationMinutes: number;
  date: string;
  billable: boolean;
  projectName: string;
  userName: string;
}

interface Project { id: string; name: string; }

export default function TimeTracking() {
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showLogTime, setShowLogTime] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    api<TimeSummary>('/api/time-entries/summary').then(setSummary);
    api<{ data: TimeEntry[] }>('/api/time-entries?limit=50').then(r => setEntries(r.data));
    api<{ data: Project[] }>('/api/projects?status=active').then(r => setProjects(r.data));
  }, []);

  async function handleLogTime(entry: { projectId: string; taskId?: string; description: string; durationMinutes: number; date: string; billable: boolean }) {
    await api('/api/time-entries', { method: 'POST', body: JSON.stringify(entry) });
    setShowLogTime(false);
    api<TimeSummary>('/api/time-entries/summary').then(setSummary);
    api<{ data: TimeEntry[] }>('/api/time-entries?limit=50').then(r => setEntries(r.data));
  }

  const formatHours = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; };

  return (
    <div>
      <TopBar title="Time Tracking" actions={<button onClick={() => setShowLogTime(true)} className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500">+ Log Time</button>} />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Hours" value={summary ? formatHours(summary.totalMinutes) : '0h'} />
        <StatCard label="Billable Hours" value={summary ? formatHours(summary.billableMinutes) : '0h'} trendColor="green" trend={summary && summary.totalMinutes > 0 ? `${Math.round((summary.billableMinutes / summary.totalMinutes) * 100)}% of total` : undefined} />
        <StatCard label="Non-Billable Hours" value={summary ? formatHours(summary.nonBillableMinutes) : '0h'} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Hours by Project</h3>
          <div className="border-t border-border">
            {!summary || summary.byProject.length === 0 ? <p className="text-sm text-gray-600 py-4 text-center">No time logged yet</p> : (
              <div className="space-y-2 pt-3">{summary.byProject.map(p => (
                <div key={p.projectId} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">{p.projectName}</span>
                  <div className="flex items-center gap-2"><span className="text-gray-500">{formatHours(p.totalMinutes)}</span><span className="text-xs text-gray-600">({formatHours(p.billableMinutes)} billable)</span></div>
                </div>
              ))}</div>
            )}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Hours by Team Member</h3>
          <div className="border-t border-border">
            {!summary || summary.byUser.length === 0 ? <p className="text-sm text-gray-600 py-4 text-center">No time logged yet</p> : (
              <div className="space-y-2 pt-3">{summary.byUser.map(u => (
                <div key={u.userId} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">{u.userName}</span>
                  <div className="flex items-center gap-2"><span className="text-gray-500">{formatHours(u.totalMinutes)}</span><span className="text-xs text-gray-600">({formatHours(u.billableMinutes)} billable)</span></div>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Recent Time Entries</h3>
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Date</th>
              <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Project</th>
              <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Description</th>
              <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Person</th>
              <th className="text-right text-xs uppercase text-gray-500 px-3 py-2 font-medium">Duration</th>
              <th className="text-right text-xs uppercase text-gray-500 px-3 py-2 font-medium">Billable</th>
            </tr></thead>
            <tbody>{entries.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-600">No time entries yet</td></tr>
            ) : entries.map(entry => (
              <tr key={entry.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{entry.projectName}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{entry.description || '---'}</td>
                <td className="px-3 py-2 text-sm text-gray-500">{entry.userName}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatHours(entry.durationMinutes)}</td>
                <td className="px-3 py-2 text-right"><Badge label={entry.billable ? 'Yes' : 'No'} variant={entry.billable ? 'green' : 'gray'} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <Modal open={showLogTime} onClose={() => setShowLogTime(false)} title="Log Time">
        {projects.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">No active projects. Create a project first.</p> : (
          <div className="space-y-3">
            <div><label className="block text-xs text-gray-500 mb-1">Project</label>
              <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                <option value="">Select a project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {selectedProjectId && <TimeEntryForm projectId={selectedProjectId} onSubmit={handleLogTime} onCancel={() => setShowLogTime(false)} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
