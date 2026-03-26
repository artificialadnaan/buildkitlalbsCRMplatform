import { useState, useEffect } from 'react';
import { portalApi } from '../lib/api.js';

interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  reviewedAt: string | null;
}

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-500/20 text-blue-400',
  reviewed: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  completed: 'bg-gray-500/20 text-gray-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
};

export default function ChangeRequests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; priority: 'low' | 'medium' | 'high' }>({ title: '', description: '', priority: 'medium' });

  useEffect(() => {
    portalApi<ChangeRequest[]>('/api/portal/change-requests')
      .then(setRequests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;

    setSubmitting(true);
    try {
      const newRequest = await portalApi<ChangeRequest>('/api/portal/change-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setRequests(prev => [newRequest, ...prev]);
      setForm({ title: '', description: '', priority: 'medium' });
      setShowForm(false);
    } catch (err) {
      console.error('Failed to submit change request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-200">Change Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Submit and track project change requests</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          New Request
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitRequest} className="bg-sidebar border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-200">Submit Change Request</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief description of the change"
              className="w-full bg-gray-800 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of what you'd like changed..."
              className="w-full bg-gray-800 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none"
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              className="bg-gray-800 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-700 text-gray-300 text-sm rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="bg-sidebar border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-200">{req.title}</h3>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{req.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Submitted {new Date(req.createdAt).toLocaleDateString()}
                    {req.reviewedAt && ` · Reviewed ${new Date(req.reviewedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${priorityColors[req.priority]}`}>
                    {req.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[req.status]}`}>
                    {req.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No change requests yet</p>
            <p className="text-sm mt-1">Click "New Request" to submit a project change</p>
          </div>
        )
      )}
    </div>
  );
}
