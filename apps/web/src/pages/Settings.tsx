import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import TopBar from '../components/layout/TopBar.js';

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  pipelineId: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  stages: Stage[];
}

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#6b7280', '#f97316', '#14b8a6',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {DEFAULT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border-2 transition-transform ${
            value === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function StageRow({
  stage,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: {
  stage: Stage;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, data: Partial<Stage>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color ?? '#6b7280');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(stage.id, { name, color });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(stage.name);
    setColor(stage.color ?? '#6b7280');
    setEditing(false);
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(stage.id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50/50 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Stage name"
            autoFocus
          />
          <span className="text-xs text-gray-500">Position {stage.position}</span>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-white/40 px-4 py-2.5 group">
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color ?? '#6b7280' }}
      />
      <span className="text-sm text-gray-900">{stage.name}</span>
      <span className="ml-auto text-xs text-gray-500">Position {stage.position}</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMove(stage.id, 'up')}
          disabled={isFirst}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => onMove(stage.id, 'down')}
          disabled={isLast}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
          title="Edit stage"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete stage"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function AddStageForm({
  pipelineId,
  nextPosition,
  onAdded,
}: {
  pipelineId: string;
  nextPosition: number;
  onAdded: (stage: Stage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [position, setPosition] = useState(nextPosition);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPosition(nextPosition);
  }, [nextPosition]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const stage = await api<Stage>(`/api/pipelines/${pipelineId}/stages`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color, position }),
      });
      onAdded(stage);
      setName('');
      setColor('#3b82f6');
      setPosition(nextPosition + 1);
      setOpen(false);
    } catch (err) {
      console.error('Failed to add stage:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Stage
      </button>
    );
  }

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/50 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Stage name"
          autoFocus
        />
        <input
          type="number"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Pos"
          min={0}
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add Stage'}
        </button>
        <button
          onClick={() => { setOpen(false); setName(''); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  const fetchPipelines = () => {
    api<Pipeline[]>('/api/pipelines').then(setPipelines).catch(console.error);
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleUpdateStage = async (stageId: string, data: Partial<Stage>) => {
    await api<Stage>(`/api/pipelines/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    fetchPipelines();
  };

  const handleDeleteStage = async (stageId: string) => {
    await api<{ success: boolean }>(`/api/pipelines/stages/${stageId}`, {
      method: 'DELETE',
    });
    fetchPipelines();
  };

  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    for (const pipeline of pipelines) {
      const sorted = [...pipeline.stages].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((s) => s.id === stageId);
      if (idx === -1) continue;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const current = sorted[idx];
      const swap = sorted[swapIdx];

      await Promise.all([
        api(`/api/pipelines/stages/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: swap.position }),
        }),
        api(`/api/pipelines/stages/${swap.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: current.position }),
        }),
      ]);
      fetchPipelines();
      return;
    }
  };

  const handleStageAdded = () => {
    fetchPipelines();
  };

  if (user?.role !== 'admin') {
    return (
      <div>
        <TopBar title="Settings" />
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Only admins can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Manage pipelines and stages" />

      <div className="p-6 space-y-6">
        {pipelines.map((pipeline) => {
          const sortedStages = [...pipeline.stages].sort((a, b) => a.position - b.position);
          const nextPosition = sortedStages.length > 0
            ? sortedStages[sortedStages.length - 1].position + 1
            : 0;

          return (
            <div key={pipeline.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900">{pipeline.name}</h2>
                {pipeline.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{pipeline.description}</p>
                )}
              </div>

              <div className="space-y-2">
                {sortedStages.map((stage, idx) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    isFirst={idx === 0}
                    isLast={idx === sortedStages.length - 1}
                    onUpdate={handleUpdateStage}
                    onDelete={handleDeleteStage}
                    onMove={handleMoveStage}
                  />
                ))}
              </div>

              <div className="mt-3">
                <AddStageForm
                  pipelineId={pipeline.id}
                  nextPosition={nextPosition}
                  onAdded={handleStageAdded}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
