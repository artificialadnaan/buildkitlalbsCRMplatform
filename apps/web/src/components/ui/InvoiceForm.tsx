import { useState } from 'react';

interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  type: 'time_entry' | 'fixed';
}

interface InvoiceFormProps {
  initialLineItems?: LineItem[];
  initialDueDate?: string;
  onSubmit: (data: { dueDate: string; lineItems: LineItem[] }) => void;
  submitLabel?: string;
}

export default function InvoiceForm({ initialLineItems = [], initialDueDate = '', onSubmit, submitLabel = 'Create Invoice' }: InvoiceFormProps) {
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialLineItems.length > 0 ? initialLineItems : [{ description: '', quantity: 1, unitPriceCents: 0, type: 'fixed' }]
  );

  function addLineItem() {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPriceCents: 0, type: 'fixed' }]);
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...lineItems];
    if (field === 'unitPriceCents') {
      // Input is in dollars, convert to cents
      updated[index] = { ...updated[index], [field]: Math.round(Number(value) * 100) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setLineItems(updated);
  }

  const total = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPriceCents), 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500 block mb-1">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 w-48"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-gray-500">Line Items</label>
          <button onClick={addLineItem} className="text-xs text-blue-600 hover:text-blue-700">+ Add Item</button>
        </div>

        <div className="space-y-2">
          {lineItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-start bg-gray-50 border border-border rounded-md p-3">
              <div className="flex-1">
                <input
                  placeholder="Description"
                  value={item.description}
                  onChange={e => updateLineItem(i, 'description', e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none mb-2"
                />
                <div className="flex gap-2">
                  <select
                    value={item.type}
                    onChange={e => updateLineItem(i, 'type', e.target.value)}
                    className="bg-white border border-border rounded text-xs text-gray-500 px-2 py-1"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="time_entry">Time Entry</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="bg-white border border-gray-300 rounded text-xs text-gray-700 px-2 py-1 w-16"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price"
                      value={(item.unitPriceCents / 100).toFixed(2)}
                      onChange={e => updateLineItem(i, 'unitPriceCents', e.target.value)}
                      className="bg-white border border-gray-300 rounded text-xs text-gray-700 px-2 py-1 w-24"
                    />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-700 mb-1">${((item.quantity * item.unitPriceCents) / 100).toFixed(2)}</div>
                {lineItems.length > 1 && (
                  <button onClick={() => removeLineItem(i)} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <div className="text-sm text-gray-500">
          Total: <span className="text-lg font-bold text-gray-900">${(total / 100).toFixed(2)}</span>
        </div>
        <button
          onClick={() => onSubmit({ dueDate, lineItems })}
          disabled={!dueDate || lineItems.some(i => !i.description || i.unitPriceCents === 0)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
