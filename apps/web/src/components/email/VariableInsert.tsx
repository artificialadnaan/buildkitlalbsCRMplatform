import { useState } from 'react';

const VARIABLE_CATEGORIES = [
  {
    category: 'Contact',
    variables: [
      { key: 'contact.first_name', label: 'Contact First Name' },
      { key: 'contact.last_name', label: 'Contact Last Name' },
      { key: 'contact.email', label: 'Contact Email' },
    ],
  },
  {
    category: 'Company',
    variables: [
      { key: 'company.name', label: 'Company Name' },
      { key: 'company.website', label: 'Company Website' },
      { key: 'company.city', label: 'Company City' },
      { key: 'company.industry', label: 'Company Industry' },
    ],
  },
  {
    category: 'Sender',
    variables: [
      { key: 'user.name', label: 'Your Name' },
      { key: 'user.email', label: 'Your Email' },
    ],
  },
  {
    category: 'Audit Data',
    variables: [
      { key: 'audit.score', label: 'Website Health Score' },
      { key: 'audit.load_time', label: 'Page Load Time (seconds)' },
      { key: 'audit.findings', label: 'Full Audit Findings' },
      { key: 'audit.top_issue', label: 'Top Website Issue' },
      { key: 'audit.specific_observation', label: 'Personalized Observation' },
    ],
  },
];

interface VariableInsertProps {
  onInsert: (variable: string) => void;
}

export default function VariableInsert({ onInsert }: VariableInsertProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 hover:border-gray-400"
      >
        {'{{ Insert Variable }}'}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-md shadow-lg z-10 w-64 max-h-80 overflow-y-auto">
          {VARIABLE_CATEGORIES.map(cat => (
            <div key={cat.category}>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-border">
                {cat.category}
              </div>
              {cat.variables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 border-b border-border last:border-0"
                >
                  <span className="text-gray-900">{v.label}</span>
                  <span className="text-gray-600 text-xs ml-2">{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
