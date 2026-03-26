import KanbanCard from './KanbanCard.js';

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
}

export default function KanbanBoard({ stages, deals }: KanbanBoardProps) {
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const totalStages = sortedStages.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {sortedStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.deal.stageId === stage.id);
        return (
          <div key={stage.id} className="space-y-4">
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {stage.name}
              </h3>
              <span className="bg-[#d8e3fb] text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                {String(stageDeals.length).padStart(2, '0')}
              </span>
            </div>

            {/* Cards */}
            {stageDeals.map((d) => (
              <KanbanCard
                key={d.deal.id}
                id={d.deal.id}
                title={d.deal.title}
                companyName={d.companyName}
                value={d.deal.value}
                stageColor={stage.color}
                stagePosition={stage.position}
                totalStages={totalStages}
              />
            ))}

            {stageDeals.length === 0 && (
              <div className="bg-[#f0f3ff] rounded-lg border border-dashed border-slate-300 flex flex-col items-center gap-2 py-10 text-center">
                <span className="material-symbols-outlined text-3xl text-slate-300">inbox</span>
                <p className="text-xs text-slate-400 font-medium">No deals in this stage</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
