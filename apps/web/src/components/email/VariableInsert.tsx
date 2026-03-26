import { useState } from 'react';

const VARIABLES = [
  { key: 'contact.first_name', label: 'Contact First Name' },
  { key: 'contact.last_name', label: 'Contact Last Name' },
  { key: 'contact.email', label: 'Contact Email' },
  { key: 'company.name', label: 'Company Name' },
  { key: 'company.website', label: 'Company Website' },
  { key: 'company.city', label: 'Company City' },
  { key: 'company.industry', label: 'Company Industry' },
  { key: 'user.name', label: 'Your Name' },
  { key: 'user.email', label: 'Your Email' },
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
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-400 hover:text-brand-600 hover:border-brand-300 transition-colors"
      >
        {'{{ Insert Variable }}'}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 w-60 overflow-hidden">
          {VARIABLES.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => { onInsert(`{{${v.key}}}`); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-50/50 border-b border-gray-50 last:border-0 transition-colors"
            >
              <span className="text-gray-900 font-medium">{v.label}</span>
              <span className="text-gray-400 text-xs ml-2">{`{{${v.key}}}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
