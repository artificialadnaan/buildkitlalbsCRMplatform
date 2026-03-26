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

export default function Settings() {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  useEffect(() => {
    api<Pipeline[]>('/api/pipelines').then(setPipelines).catch(console.error);
  }, []);

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
        {pipelines.map((pipeline) => (
          <div key={pipeline.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-100">{pipeline.name}</h2>
              {pipeline.description && (
                <p className="mt-0.5 text-sm text-gray-500">{pipeline.description}</p>
              )}
            </div>

            <div className="space-y-2">
              {pipeline.stages
                .sort((a, b) => a.position - b.position)
                .map((stage) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-gray-900/40 px-4 py-2.5"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color ?? '#6b7280' }}
                    />
                    <span className="text-sm text-gray-200">{stage.name}</span>
                    <span className="ml-auto text-xs text-gray-500">Position {stage.position}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
