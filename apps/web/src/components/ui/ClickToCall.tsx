import { useState } from 'react';
import { api } from '../../lib/api.js';

interface ClickToCallProps {
  contactId: string;
  phone: string;
  contactName?: string;
  dealId?: string;
  size?: 'sm' | 'md';
}

export default function ClickToCall({ contactId, phone, contactName, dealId, size = 'sm' }: ClickToCallProps) {
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleCall() {
    setCalling(true);
    setStatus(null);
    try {
      const res = await api<{ message: string }>('/api/sms/call', {
        method: 'POST',
        body: JSON.stringify({ contactId, dealId }),
      });
      setStatus(res.message);
      setTimeout(() => setStatus(null), 5000);
    } catch (err) {
      setStatus('Call failed');
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setCalling(false);
    }
  }

  if (size === 'md') {
    return (
      <div>
        <button
          onClick={handleCall}
          disabled={calling}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">call</span>
          {calling ? 'Connecting...' : `Call ${contactName || phone}`}
        </button>
        {status && <p className="text-xs text-green-600 mt-1">{status}</p>}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center">
      <button
        onClick={handleCall}
        disabled={calling}
        title={`Call ${contactName || phone}`}
        className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
        <span className="text-xs font-bold">{calling ? 'Calling...' : phone}</span>
      </button>
      {status && <span className="text-[10px] text-green-500 ml-2">{status}</span>}
    </span>
  );
}
