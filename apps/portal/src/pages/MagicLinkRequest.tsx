import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { portalApi } from '../lib/api.js';

export default function MagicLinkRequest() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const authError = searchParams.get('error');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await portalApi('/portal/auth/request-link', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      navigate('/login/sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent mb-1">
          BuildKit Labs
        </h1>
        <p className="text-gray-500 text-sm mb-6">Client Portal</p>

        {authError === 'invalid_or_expired' && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md p-3 mb-4">
            Your login link has expired. Please request a new one.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-950 border border-border rounded-lg px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Login Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
