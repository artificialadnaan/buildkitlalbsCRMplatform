import { useState } from 'react';
import Modal from './Modal.js';
import { api } from '../../lib/api.js';

interface SendSmsModalProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  contactPhone: string;
  dealId?: string;
  onSent: () => void;
}

export default function SendSmsModal({
  open,
  onClose,
  contactId,
  contactName,
  contactPhone,
  dealId,
  onSent,
}: SendSmsModalProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = body.length;
  const smsLimit = 160;
  const overLimit = charCount > smsLimit;

  async function handleSend() {
    if (!body.trim() || overLimit) return;
    setSending(true);
    setError(null);
    try {
      await api('/api/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          body: body.trim(),
          ...(dealId ? { dealId } : {}),
        }),
      });
      setBody('');
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setBody('');
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Send SMS">
      <div className="space-y-4">
        {/* Recipient */}
        <div className="flex items-center gap-3 p-3 bg-[#f0f3ff] rounded-lg">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-sm shrink-0">
            {contactName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{contactName}</p>
            <p className="text-xs text-slate-500">{contactPhone}</p>
          </div>
          <span className="ml-auto px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest rounded">SMS</span>
        </div>

        {/* Message */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className={`text-[10px] font-bold ${overLimit ? 'text-red-600' : charCount > 140 ? 'text-orange-500' : 'text-slate-400'}`}>
              {charCount}/{smsLimit}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !body.trim() || overLimit}
            className="rounded-lg bg-gradient-to-r from-orange-700 to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {sending ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">send</span>
                Send SMS
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
