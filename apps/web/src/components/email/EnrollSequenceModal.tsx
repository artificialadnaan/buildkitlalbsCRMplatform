import { useState, useEffect } from 'react';
import Modal from '../ui/Modal.js';
import Badge from '../ui/Badge.js';
import { api } from '../../lib/api.js';

interface Sequence {
  id: string;
  name: string;
  pipelineType: string;
  stepCount: number;
}

interface Enrollment {
  id: string;
  sequenceName: string;
  status: string;
  currentStep: number;
  pausedReason: string | null;
  nextSendAt: string | null;
}

interface EnrollSequenceModalProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  contactId: string;
  onEnrolled: () => void;
}

export default function EnrollSequenceModal({
  open, onClose, dealId, contactId, onEnrolled,
}: EnrollSequenceModalProps) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (open) {
      api<{ data: Sequence[] }>('/api/email-sequences').then(r => setSequences(r.data));
      api<{ data: Enrollment[] }>(`/api/sequence-enrollments?dealId=${dealId}`).then(r => setEnrollments(r.data));
    }
  }, [open, dealId]);

  async function handleEnroll() {
    setEnrolling(true);
    try {
      await api('/api/sequence-enrollments', {
        method: 'POST',
        body: JSON.stringify({ dealId, sequenceId: selectedSequenceId, contactId }),
      });
      onEnrolled();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function handlePause(enrollmentId: string) {
    await api(`/api/sequence-enrollments/${enrollmentId}/pause`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'manual' }),
    });
    api<{ data: Enrollment[] }>(`/api/sequence-enrollments?dealId=${dealId}`).then(r => setEnrollments(r.data));
  }

  async function handleResume(enrollmentId: string) {
    await api(`/api/sequence-enrollments/${enrollmentId}/resume`, { method: 'PATCH' });
    api<{ data: Enrollment[] }>(`/api/sequence-enrollments?dealId=${dealId}`).then(r => setEnrollments(r.data));
  }

  async function handleCancel(enrollmentId: string) {
    if (!confirm('Cancel this sequence?')) return;
    await api(`/api/sequence-enrollments/${enrollmentId}/cancel`, { method: 'PATCH' });
    api<{ data: Enrollment[] }>(`/api/sequence-enrollments?dealId=${dealId}`).then(r => setEnrollments(r.data));
  }

  const statusVariant: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = {
    active: 'green',
    paused: 'amber',
    completed: 'blue',
    cancelled: 'red',
  };

  return (
    <Modal open={open} onClose={onClose} title="Email Sequences">
      <div className="space-y-4">
        {/* Active enrollments */}
        {enrollments.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">Current Enrollments</h4>
            <div className="space-y-2">
              {enrollments.map(e => (
                <div key={e.id} className="bg-slate-900 border border-border rounded-md px-3 py-2 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-300">{e.sequenceName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge label={e.status} variant={statusVariant[e.status] || 'gray'} />
                      <span className="text-xs text-gray-600">Step {e.currentStep}</span>
                      {e.pausedReason === 'reply_received' && (
                        <span className="text-xs text-amber-500">Reply received</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {e.status === 'active' && (
                      <button onClick={() => handlePause(e.id)} className="text-xs text-amber-500 hover:text-amber-400 px-2 py-1">
                        Pause
                      </button>
                    )}
                    {e.status === 'paused' && (
                      <button onClick={() => handleResume(e.id)} className="text-xs text-green-500 hover:text-green-400 px-2 py-1">
                        Resume
                      </button>
                    )}
                    {(e.status === 'active' || e.status === 'paused') && (
                      <button onClick={() => handleCancel(e.id)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enroll in new sequence */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">Enroll in Sequence</h4>
          <select
            value={selectedSequenceId}
            onChange={e => setSelectedSequenceId(e.target.value)}
            className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 mb-2"
          >
            <option value="">Select a sequence...</option>
            {sequences.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.stepCount} steps)</option>
            ))}
          </select>
          <button
            onClick={handleEnroll}
            disabled={enrolling || !selectedSequenceId}
            className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {enrolling ? 'Enrolling...' : 'Start Sequence'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
