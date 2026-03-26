import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';

interface SearchResult {
  id: string;
  type: 'company' | 'contact' | 'deal' | 'project';
  title: string;
  subtitle: string;
}

interface SearchResponse {
  results: SearchResult[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<string, { label: string; badge: string; icon: string; path: string }> = {
  company: {
    label: 'Companies',
    badge: 'bg-blue-100 text-blue-700',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    path: '/leads',
  },
  contact: {
    label: 'Contacts',
    badge: 'bg-green-100 text-green-700',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    path: '/leads',
  },
  deal: {
    label: 'Deals',
    badge: 'bg-purple-100 text-purple-700',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    path: '/deals',
  },
  project: {
    label: 'Projects',
    badge: 'bg-orange-100 text-orange-700',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    path: '/projects',
  },
};

const GROUP_ORDER = ['company', 'contact', 'deal', 'project'] as const;

function groupResults(results: SearchResult[]) {
  const groups: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  }
  return groups;
}

function buildFlatList(groups: Record<string, SearchResult[]>): SearchResult[] {
  const flat: SearchResult[] = [];
  for (const type of GROUP_ORDER) {
    if (groups[type]) flat.push(...groups[type]);
  }
  return flat;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => {
          setResults(res.results ?? []);
          setSelectedIndex(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const groups = groupResults(results);
  const flatList = buildFlatList(groups);

  function navigateToResult(result: SearchResult) {
    const config = typeConfig[result.type];
    if (!config) return;
    if (result.type === 'contact') {
      // contacts go to their company page
      navigate(`/leads/${result.id}`);
    } else {
      navigate(`${config.path}/${result.id}`);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIndex]) {
      navigateToResult(flatList[selectedIndex]);
    }
  }

  if (!isOpen) return null;

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ alignItems: 'flex-start' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 mx-auto mt-[20vh] w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-gray-200 px-4">
          <svg className="h-5 w-5 flex-shrink-0 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search companies, contacts, deals, projects..."
            className="w-full py-3 text-lg text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          {loading && (
            <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#1F4D78] flex-shrink-0" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Type to search...</p>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No results found for "{query}"</p>
          )}

          {GROUP_ORDER.map((type) => {
            const group = groups[type];
            if (!group || group.length === 0) return null;
            const config = typeConfig[type];

            return (
              <div key={type}>
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {config.label}
                  </span>
                </div>
                {group.map((result) => {
                  const itemIndex = globalIndex++;
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <button
                      key={result.id}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      onClick={() => navigateToResult(result)}
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${config.badge}`}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{result.title}</p>
                        {result.subtitle && (
                          <p className="truncate text-xs text-gray-500">{result.subtitle}</p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                        {type}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 text-xs text-gray-400">
            <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">↵</kbd> open</span>
            <span><kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}
