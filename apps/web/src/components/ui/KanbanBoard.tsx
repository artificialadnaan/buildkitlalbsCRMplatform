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
                <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                  <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  <p className="text-xs text-gray-600 leading-snug">No deals in this stage —<br />create one from the Leads page</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
