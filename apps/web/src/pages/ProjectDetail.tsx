import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import ProgressBar from '../components/ui/ProgressBar.js';
import MilestoneTimeline from '../components/ui/MilestoneTimeline.js';
import TaskList from '../components/ui/TaskList.js';
import TimeEntryForm from '../components/ui/TimeEntryForm.js';
import Modal from '../components/ui/Modal.js';
import { api } from '../lib/api.js';

interface ProjectData {
  project: {
    id: string;
    name: string;
    type: 'website' | 'software';
    status: 'active' | 'on_hold' | 'completed';
    budget: number | null;
    startDate: string | null;
    targetLaunchDate: string | null;
    createdAt: string;
  };
  companyName: string;
  assignedToName: string | null;
}

interface Milestone {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  dueDate: string | null;
  position: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  assignedToName: string | null;
}

interface TimeEntry {
  id: string;
  description: string | null;
  durationMinutes: number;
  date: string;
  billable: boolean;
  userName: string;
}

interface TimeSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
}

const statusVariant: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = {
  active: 'green',
  on_hold: 'amber',
  completed: 'blue',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeSummary, setTimeSummary] = useState<TimeSummary | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showLogTime, setShowLogTime] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const loadProject = useCallback(() => {
    if (!id) return;
    api<ProjectData>(`/api/projects/${id}`).then(setProject);
    api<Milestone[]>(`/api/projects/${id}/milestones`).then(data => {
      setMilestones(data);
      const active = data.find(m => m.status === 'in_progress') || data.find(m => m.status === 'pending');
      if (active && !activeMilestoneId) setActiveMilestoneId(active.id);
    });
    api<{ data: TimeEntry[] }>(`/api/time-entries?projectId=${id}`).then(r => setTimeEntries(r.data));
    api<TimeSummary>(`/api/time-entries/summary?projectId=${id}`).then(setTimeSummary);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  useEffect(() => {
    if (!activeMilestoneId) { setTasks([]); return; }
    api<Task[]>(`/api/milestones/${activeMilestoneId}/tasks`).then(setTasks);
  }, [activeMilestoneId]);

  async function handleToggleTaskStatus(taskId: string, newStatus: string) {
    await api(`/api/milestones/${activeMilestoneId}/tasks/${taskId}`, {
      method: 'PATCH', body: JSON.stringify({ status: newStatus }),
    });
    api<Task[]>(`/api/milestones/${activeMilestoneId}/tasks`).then(setTasks);
    api<Milestone[]>(`/api/projects/${id}/milestones`).then(setMilestones);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim() || !activeMilestoneId) return;
    await api(`/api/milestones/${activeMilestoneId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: newTaskTitle, priority: newTaskPriority, dueDate: newTaskDueDate || undefined }),
    });
    setNewTaskTitle(''); setNewTaskPriority('medium'); setNewTaskDueDate(''); setShowAddTask(false);
    api<Task[]>(`/api/milestones/${activeMilestoneId}/tasks`).then(setTasks);
  }

  async function handleLogTime(entry: { projectId: string; taskId?: string; description: string; durationMinutes: number; date: string; billable: boolean }) {
    await api('/api/time-entries', { method: 'POST', body: JSON.stringify(entry) });
    setShowLogTime(false);
    loadProject();
  }

  if (!project) return <div className="text-gray-500">Loading...</div>;

  const doneMilestones = milestones.filter(m => m.status === 'done').length;
  const milestoneProgress = milestones.length > 0 ? (doneMilestones / milestones.length) * 100 : 0;
  const formatHours = (min: number) => { const h = Math.floor(min / 60); const m = min % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; };

  return (
    <div>
      <TopBar title={project.project.name} subtitle={project.companyName} actions={
        <div className="flex gap-2">
          <button onClick={() => setShowLogTime(true)} className="bg-gray-100 border border-gray-300 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-900">Log Time</button>
          <button onClick={() => navigate('/projects')} className="bg-gray-100 border border-gray-300 px-3 py-2 rounded-md text-sm text-gray-500">Back</button>
        </div>
      } />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase text-gray-500">Status</div>
          <div className="mt-1"><Badge label={project.project.status} variant={statusVariant[project.project.status]} /></div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase text-gray-500">Type</div>
          <div className="text-lg font-bold text-gray-900 mt-1 capitalize">{project.project.type}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase text-gray-500">Budget</div>
          <div className="text-lg font-bold text-gray-900 mt-1">{project.project.budget != null ? `$${project.project.budget.toLocaleString()}` : '---'}</div>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase text-gray-500">Time Logged</div>
          <div className="text-lg font-bold text-gray-900 mt-1">{timeSummary ? formatHours(timeSummary.totalMinutes) : '0h'}</div>
          {timeSummary && timeSummary.totalMinutes > 0 && <div className="text-xs text-gray-500 mt-0.5">{formatHours(timeSummary.billableMinutes)} billable</div>}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <ProgressBar percent={milestoneProgress} label={`${doneMilestones} of ${milestones.length} milestones complete`} color={milestoneProgress === 100 ? 'bg-green-500' : 'bg-blue-500'} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Milestones</h3>
          <MilestoneTimeline milestones={milestones} activeMilestoneId={activeMilestoneId || undefined} onMilestoneClick={m => setActiveMilestoneId(m.id)} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Tasks{activeMilestoneId && <span className="text-gray-500 font-normal text-sm ml-2">{milestones.find(m => m.id === activeMilestoneId)?.name}</span>}</h3>
            {activeMilestoneId && <button onClick={() => setShowAddTask(true)} className="text-sm text-blue-500 hover:text-blue-600">+ Add Task</button>}
          </div>
          {!activeMilestoneId ? <p className="text-sm text-gray-600 py-4 text-center">Select a milestone to view its tasks</p> : <TaskList tasks={tasks} onToggleStatus={handleToggleTaskStatus} />}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-900">Recent Time Entries</h3>
          <button onClick={() => setShowLogTime(true)} className="text-sm text-blue-500 hover:text-blue-600">+ Log Time</button>
        </div>
        <div className="border-t border-border">
          {timeEntries.length === 0 ? <p className="text-sm text-gray-600 py-4 text-center">No time logged yet</p> : (
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Date</th>
                <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Description</th>
                <th className="text-left text-xs uppercase text-gray-500 px-3 py-2 font-medium">Person</th>
                <th className="text-right text-xs uppercase text-gray-500 px-3 py-2 font-medium">Duration</th>
                <th className="text-right text-xs uppercase text-gray-500 px-3 py-2 font-medium">Billable</th>
              </tr></thead>
              <tbody>{timeEntries.slice(0, 10).map(entry => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{entry.description || '---'}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">{entry.userName}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatHours(entry.durationMinutes)}</td>
                  <td className="px-3 py-2 text-right"><Badge label={entry.billable ? 'Yes' : 'No'} variant={entry.billable ? 'green' : 'gray'} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task">
        <div className="space-y-3">
          <input placeholder="Task title" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Priority</label><select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Due Date</label><input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></div>
          </div>
          <button onClick={handleAddTask} className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-500">Add Task</button>
        </div>
      </Modal>

      <Modal open={showLogTime} onClose={() => setShowLogTime(false)} title="Log Time">
        <TimeEntryForm projectId={id!} onSubmit={handleLogTime} onCancel={() => setShowLogTime(false)} tasks={tasks.filter(t => t.status !== 'done').map(t => ({ id: t.id, title: t.title }))} />
      </Modal>
    </div>
  );
}
