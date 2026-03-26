import { useEffect, useState, useCallback } from 'react';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import ProgressBar from '../components/ui/ProgressBar.js';
import { api } from '../lib/api.js';

interface ScrapeJob {
  id: string;
  zipCodes: string[];
  searchQuery: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  totalFound: number;
  newLeads: number;
  duplicatesSkipped: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_VARIANTS: Record<string, 'amber' | 'blue' | 'green' | 'red'> = {
  pending: 'amber',
  running: 'blue',
  done: 'green',
  failed: 'red',
};

export default function Scraper() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [zipInput, setZipInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api<{ data: ScrapeJob[] }>('/api/scrape/jobs');
      setJobs(res.data);
    } catch {
      // Silently fail on poll
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll for updates when any job is running or pending
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;

    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Parse zip codes from comma/space/newline separated input
    const zipCodes = zipInput
      .split(/[,\s\n]+/)
      .map(z => z.trim())
      .filter(z => /^\d{5}$/.test(z));

    if (zipCodes.length === 0) {
      setError('Enter at least one valid 5-digit zip code');
      return;
    }

    if (!searchQuery.trim()) {
      setError('Enter a search query (e.g., "plumbers", "restaurants")');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/scrape', {
        method: 'POST',
        body: JSON.stringify({ zipCodes, searchQuery: searchQuery.trim() }),
      });
      setZipInput('');
      setSearchQuery('');
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape job');
    } finally {
      setSubmitting(false);
    }
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start) return '\u2014';
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.round((endMs - startMs) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  return (
    <div>
      <TopBar title="Lead Scraper" subtitle="Google Maps lead generation" />

      {/* Scrape Form */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-6">
        <h3 className="font-semibold text-gray-200 mb-4">New Scrape Job</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Zip Codes</label>
              <textarea
                value={zipInput}
                onChange={e => setZipInput(e.target.value)}
                placeholder={"75201, 75202, 75203\nOr one per line..."}
                rows={3}
                className="w-full bg-gray-950 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-600 mt-1">
                Comma or newline separated. {zipInput.split(/[,\s\n]+/).filter(z => /^\d{5}$/.test(z.trim())).length} valid zip(s) entered.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Search Query</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder='e.g., "plumbers", "restaurants", "roofing contractors"'
                className="w-full bg-gray-950 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-600 mt-3">
                Estimated cost: ~$34 per 1,000 leads (Google Places API).
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 px-4 py-2.5 rounded-md text-sm text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Starting...' : 'Start Scraping'}
          </button>
        </form>
      </div>

      {/* Job History */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="font-semibold text-gray-200 mb-4">Scrape Jobs</h3>

        {jobs.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-6">No scrape jobs yet. Start one above.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-gray-950 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-300">
                      &ldquo;{job.searchQuery}&rdquo;
                    </span>
                    <span className="text-xs text-gray-500">
                      {job.zipCodes.length} zip{job.zipCodes.length !== 1 ? 's' : ''}
                    </span>
                    <Badge label={job.status} variant={STATUS_VARIANTS[job.status]} />
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>

                {(job.status === 'running' || job.status === 'pending') && (
                  <div className="mb-3">
                    <ProgressBar
                      value={job.status === 'pending' ? 0 : ((job.totalFound > 0 ? 50 : 10))}
                      label={job.status === 'pending' ? 'Waiting to start...' : 'Scraping in progress...'}
                      color={job.status === 'pending' ? 'bg-amber-500' : 'bg-blue-500'}
                    />
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Found:</span>{' '}
                    <span className="text-gray-300 font-medium">{job.totalFound}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">New Leads:</span>{' '}
                    <span className="text-green-500 font-medium">{job.newLeads}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duplicates:</span>{' '}
                    <span className="text-gray-400">{job.duplicatesSkipped}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration:</span>{' '}
                    <span className="text-gray-300">
                      {formatDuration(job.startedAt, job.completedAt)}
                    </span>
                  </div>
                </div>

                {job.errorMessage && (
                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
                    {job.errorMessage}
                  </div>
                )}

                {job.status === 'done' && (
                  <div className="mt-2 text-xs text-gray-600">
                    Zip codes: {job.zipCodes.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
