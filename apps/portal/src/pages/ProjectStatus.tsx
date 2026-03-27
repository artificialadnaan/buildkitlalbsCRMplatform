import { useEffect, useState } from 'react';
import { usePortalAuth } from '../lib/auth.js';
import { portalApi } from '../lib/api.js';

interface MilestoneProgress {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  position: number;
  taskTotal: number;
  taskCompleted: number;
  completionPercent: number;
}

interface ProgressData {
  milestones: MilestoneProgress[];
  overallProgress: number;
  completedCount: number;
  totalCount: number;
}

const milestoneStatusConfig = {
  done: {
    dot: 'bg-green-100 border-green-500 text-green-600',
    label: 'text-green-600',
    connector: 'bg-green-400',
  },
  in_progress: {
    dot: 'bg-purple-100 border-purple-500 text-purple-600',
    label: 'text-purple-600',
    connector: 'bg-gray-600',
  },
  pending: {
    dot: 'bg-gray-800 border-gray-600 text-gray-400',
    label: 'text-gray-400',
    connector: 'bg-gray-600',
  },
};

export default function ProjectStatus() {
  const { activeProject } = usePortalAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    portalApi<ProgressData>(`/portal/projects/${activeProject.id}/progress`)
      .then(setData)
      .catch(err => {
        console.error('Failed to load progress:', err);
        setError('Failed to load project progress.');
      })
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No projects found.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const activeMilestone =
    data.milestones.find(m => m.status === 'in_progress') ??
    data.milestones.find(m => m.status === 'pending') ??
    null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-200">{activeProject.name}</h2>
        <p className="text-sm text-gray-500 mt-1">Project Progress</p>
      </div>

      {/* Overall progress bar */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-200">Overall Progress</h3>
          <span className="text-sm text-gray-500">
            {data.completedCount} of {data.totalCount} milestones complete
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-purple-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${data.overallProgress}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">{data.overallProgress}%</div>
      </div>

      {/* Milestone stepper */}
      {data.milestones.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-6 overflow-x-auto">
          <h3 className="font-semibold text-gray-200 mb-6">Milestones</h3>
          <div className="flex items-start min-w-max">
            {data.milestones.map((m, i) => {
              const cfg = milestoneStatusConfig[m.status];
              return (
                <div key={m.id} className="flex items-center">
                  <div className={`flex flex-col items-center ${cfg.label}`}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 text-sm font-semibold ${cfg.dot}`}
                    >
                      {m.status === 'done' ? '✓' : i + 1}
                    </div>
                    <span className="text-xs mt-2 font-medium text-gray-300 max-w-[80px] text-center leading-tight">
                      {m.name}
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">{m.completionPercent}%</span>
                  </div>
                  {i < data.milestones.length - 1 && (
                    <div className={`h-0.5 w-16 mx-2 mt-[-20px] ${cfg.connector}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active milestone detail */}
      {activeMilestone ? (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-200">
              {activeMilestone.status === 'in_progress' ? 'Current Milestone' : 'Next Milestone'}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeMilestone.status === 'in_progress'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {activeMilestone.status === 'in_progress' ? 'In Progress' : 'Pending'}
            </span>
          </div>

          <p className="text-gray-300 font-medium mb-4">{activeMilestone.name}</p>

          {activeMilestone.taskTotal > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 mb-3">
                {activeMilestone.taskCompleted} of {activeMilestone.taskTotal} tasks complete
              </p>
              {/* Progress bar for milestone tasks */}
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${activeMilestone.completionPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No tasks assigned to this milestone yet.</p>
          )}
        </div>
      ) : data.milestones.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-gray-600">
          No milestones defined yet.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-6 text-center text-sm text-gray-500">
          All milestones complete.
        </div>
      )}
    </div>
  );
}
