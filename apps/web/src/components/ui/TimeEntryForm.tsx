import { useState } from 'react';

interface TimeEntryFormProps {
  projectId: string;
  onSubmit: (entry: {
    projectId: string;
    taskId?: string;
    description: string;
    durationMinutes: number;
    date: string;
    billable: boolean;
  }) => void;
  onCancel?: () => void;
  tasks?: { id: string; title: string }[];
}

export default function TimeEntryForm({ projectId, onSubmit, onCancel, tasks }: TimeEntryFormProps) {
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [billable, setBillable] = useState(true);
  const [taskId, setTaskId] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalMinutes = (parseInt(hours || '0') * 60) + parseInt(minutes || '0');
    if (totalMinutes <= 0) return;

    onSubmit({
      projectId,
      taskId: taskId || undefined,
      description,
      durationMinutes: totalMinutes,
      date,
      billable,
    });

    setDescription('');
    setHours('');
    setMinutes('');
    setTaskId('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What did you work on?"
          className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hours</label>
          <input
            type="number"
            min="0"
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Minutes</label>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={e => setMinutes(e.target.value)}
            placeholder="0"
            className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
          />
        </div>
      </div>

      {tasks && tasks.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Task (optional)</label>
          <select
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
            className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
          >
            <option value="">No specific task</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="billable"
          checked={billable}
          onChange={e => setBillable(e.target.checked)}
          className="rounded border-gray-600"
        />
        <label htmlFor="billable" className="text-sm text-gray-400">Billable</label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-500"
        >
          Log Time
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-border border border-gray-700 px-4 py-2 rounded-md text-sm text-gray-400"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
