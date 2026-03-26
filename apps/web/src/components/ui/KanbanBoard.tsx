import { useState, type DragEvent } from 'react';
import KanbanCard from './KanbanCard.js';
import { api } from '../../lib/api.js';

interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

interface Deal {
  deal: {
    id: string;
    title: string;
    value: number | null;
    stageId: string;
  };
  companyName: string | null;
  stageName: string | null;
  stageColor: string | null;
  stagePosition: number | null;
}

interface KanbanBoardProps {
  stages: Stage[];
  deals: Deal[];
  onDealMoved?: () => void;
}

export default function KanbanBoard({ stages, deals, onDealMoved }: KanbanBoardProps) {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const totalStages = sortedStages.length;
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

  function handleDragStart(e: DragEvent, dealId: string) {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingDealId(dealId);
  }

  function handleDragOver(e: DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  }

  function handleDragLeave() {
    setDragOverStageId(null);
  }

  async function handleDrop(e: DragEvent, targetStageId: string) {
    e.preventDefault();
    setDragOverStageId(null);
    setDraggingDealId(null);

    const dealId = e.dataTransfer.getData('text/plain');
    if (!dealId) return;

    // Find the deal to check if it's already in this stage
    const deal = deals.find(d => d.deal.id === dealId);
    if (!deal || deal.deal.stageId === targetStageId) return;

    try {
      await api(`/api/deals/${dealId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stageId: targetStageId }),
      });
      onDealMoved?.();
    } catch (err) {
      console.error('Failed to move deal:', err);
    }
  }

  function handleDragEnd() {
    setDragOverStageId(null);
    setDraggingDealId(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {sortedStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.deal.stageId === stage.id);
        const isOver = dragOverStageId === stage.id;

        return (
          <div
            key={stage.id}
            className={`space-y-4 rounded-lg p-3 -m-3 transition-all duration-200 ${
              isOver ? 'bg-orange-50 ring-2 ring-orange-400 ring-dashed' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {stage.name}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isOver ? 'bg-orange-200 text-orange-700' : 'bg-[#d8e3fb] text-slate-600'
              }`}>
                {String(stageDeals.length).padStart(2, '0')}
              </span>
            </div>

            {/* Cards */}
            {stageDeals.map((d) => (
              <div
                key={d.deal.id}
                draggable
                onDragStart={(e) => handleDragStart(e, d.deal.id)}
                onDragEnd={handleDragEnd}
                className={`cursor-grab active:cursor-grabbing transition-opacity ${
                  draggingDealId === d.deal.id ? 'opacity-40' : ''
                }`}
              >
                <KanbanCard
                  id={d.deal.id}
                  title={d.deal.title}
                  companyName={d.companyName}
                  value={d.deal.value}
                  stageColor={stage.color}
                  stagePosition={stage.position}
                  totalStages={totalStages}
                />
              </div>
            ))}

            {/* Drop zone when empty or dragging */}
            {(stageDeals.length === 0 || isOver) && stageDeals.length === 0 && (
              <div className={`rounded-lg border-2 border-dashed flex flex-col items-center gap-2 py-10 text-center transition-colors ${
                isOver
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-300 bg-[#f0f3ff]'
              }`}>
                <span className="material-symbols-outlined text-3xl text-slate-300">
                  {isOver ? 'move_item' : 'inbox'}
                </span>
                <p className="text-xs text-slate-400 font-medium">
                  {isOver ? 'Drop here' : 'No deals in this stage'}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
