import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import KanbanBoard from '../components/ui/KanbanBoard.js';

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

interface DealRow {
  deal: {
    id: string;
    title: string;
    value: number | null;
    stageId: string;
    pipelineId: string;
  };
  companyName: string | null;
  contactName: string | null;
  stageName: string | null;
  stageColor: string | null;
  stagePosition: number | null;
}

interface DealsResponse {
  data: DealRow[];
  total: number;
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);

  useEffect(() => {
    api<Pipeline[]>('/api/pipelines')
      .then((data) => {
        setPipelines(data);
        if (data.length > 0) {
          setActivePipelineId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activePipelineId) return;
    api<DealsResponse>(`/api/deals?pipelineId=${activePipelineId}`)
      .then((res) => setDeals(res.data))
      .catch(console.error);
  }, [activePipelineId]);

  const activePipeline = pipelines.find((p) => p.id === activePipelineId);

  return (
    <div>
      <TopBar
        title="Pipelines"
        subtitle={activePipeline?.description ?? undefined}
      />

      <div className="p-6">
        {/* Pipeline Tabs */}
        {pipelines.length > 1 && (
          <div className="mb-4 flex gap-2">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePipelineId(p.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  p.id === activePipelineId
                    ? 'bg-blue-600 text-white'
                    : 'border border-border bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Kanban */}
        {activePipeline && (
          <KanbanBoard stages={activePipeline.stages} deals={deals} />
        )}
      </div>
    </div>
  );
}
