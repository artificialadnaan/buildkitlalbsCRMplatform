import { useState, useEffect } from 'react';
import Modal from '../ui/Modal.js';
import SendLimitBadge from './SendLimitBadge.js';
import { api } from '../../lib/api.js';

interface Template {
  id: string;
  name: string;
  subject: string;
}

interface ComposeEmailModalProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  onSent: () => void;
}

export default function ComposeEmailModal({
  open, onClose, dealId, contactId, contactName, contactEmail, onSent,
}: ComposeEmailModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);

  useEffect(() => {
    if (open) {
      api<{ data: Template[] }>('/api/email-templates').then(r => setTemplates(r.data));
    }
  }, [open]);

  async function handleSend() {
    setSending(true);
    try {
      const payload: Record<string, string> = { dealId, contactId };

      if (useTemplate && selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      } else {
        payload.subject = subject;
        payload.bodyHtml = bodyHtml;
      }

      await api('/api/email-sends', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSent();
      onClose();
      setSelectedTemplateId('');
      setSubject('');
      setBodyHtml('');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send Email">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">To: <span className="text-gray-700">{contactName} ({contactEmail})</span></span>
          <SendLimitBadge />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setUseTemplate(true)}
            className={`px-3 py-1.5 rounded-md text-xs ${useTemplate ? 'bg-blue-600 text-white' : 'bg-surface border border-border text-gray-500'}`}
          >
            Use Template
          </button>
          <button
            onClick={() => setUseTemplate(false)}
            className={`px-3 py-1.5 rounded-md text-xs ${!useTemplate ? 'bg-blue-600 text-white' : 'bg-surface border border-border text-gray-500'}`}
          >
            Custom Email
          </button>
        </div>

        {useTemplate ? (
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              placeholder="Subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
            />
            <textarea
              placeholder="Email body (HTML supported)..."
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              rows={5}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 placeholder-gray-400 resize-none"
            />
          </>
        )}

        <button
          onClick={handleSend}
          disabled={sending || (useTemplate ? !selectedTemplateId : !subject)}
          className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </div>
    </Modal>
  );
}
