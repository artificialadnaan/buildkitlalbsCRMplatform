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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {sortedStages.map((stage) => {
        const stageDeals = deals.filter((d) => d.deal.stageId === stage.id);
        return (
          <div
            key={stage.id}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-gray-900/30"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: stage.color ?? '#6b7280' }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">{stage.name}</span>
              <span className="ml-auto text-xs text-gray-500">{stageDeals.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-3 min-h-[120px]">
              {stageDeals.map((d) => (
                <KanbanCard
                  key={d.deal.id}
                  id={d.deal.id}
                  title={d.deal.title}
                  companyName={d.companyName}
                  value={d.deal.value}
                />
              ))}
              {stageDeals.length === 0 && (
                <p className="text-center text-xs text-gray-600 py-4">No deals</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
