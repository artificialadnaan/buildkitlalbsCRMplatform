import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  idKey?: string;
}

export default function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found',
  emptyAction,
  selectable = false,
  selectedIds,
  onSelectionChange,
  idKey = 'id',
}: DataTableProps<T>) {
  const allIds = data.map((row) => String((row as Record<string, unknown>)[idKey]));
  const allSelected = data.length > 0 && allIds.every((id) => selectedIds?.has(id));
  const someSelected = allIds.some((id) => selectedIds?.has(id));

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {selectable && (
              <th className="w-10 px-3 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 bg-white text-brand-500 focus:ring-brand-500"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-full bg-gray-50 p-3">
                    <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">{emptyMessage}</p>
                  {emptyAction && (
                    <button
                      onClick={emptyAction.onClick}
                      className="btn-secondary text-xs"
                    >
                      {emptyAction.label}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const rowId = String((row as Record<string, unknown>)[idKey]);
              const isSelected = selectedIds?.has(rowId) ?? false;
              return (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-gray-50 transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${isSelected ? 'bg-brand-50/50' : 'hover:bg-gray-50/80'}`}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(rowId)}
                        className="h-4 w-4 rounded border-gray-300 bg-white text-brand-500 focus:ring-brand-500"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-gray-700">
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '--')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
