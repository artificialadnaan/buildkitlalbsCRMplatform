import { useState } from 'react';
import { api } from '../../lib/api.js';

interface AuditChecks {
  loadTimeMs: number | null;
  isHttps: boolean;
  hasMobileViewport: boolean;
  hasTitle: boolean;
  titleText: string | null;
  hasMetaDescription: boolean;
  brokenImageCount: number;
  totalImageCount: number;
  copyrightYear: number | null;
  hasContactForm: boolean;
  hasH1: boolean;
  h1Text: string | null;
  hasRobotsTxt: boolean;
  pagesCrawled: number;
}

export interface WebsiteAudit {
  score: number;
  findings: string;
  checks: AuditChecks;
  auditedAt?: string;
}

interface WebsiteAuditCardProps {
  companyId: string;
  audit: WebsiteAudit | null;
  onReaudit: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  let color = '#ef4444'; // red
  if (score > 60) color = '#22c55e'; // green
  else if (score > 30) color = '#f59e0b'; // amber

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xl font-bold text-gray-900">{score}</span>
    </div>
  );
}

function CheckRow({ pass, label, value }: { pass: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {pass ? (
        <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="text-gray-500">{label}</span>
      <span className="ml-auto truncate font-medium text-gray-800">{value}</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function WebsiteAuditCard({ companyId, audit, onReaudit }: WebsiteAuditCardProps) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function runAudit() {
    setLoading(true);
    try {
      await api(`/api/companies/${companyId}/audit`, { method: 'POST' });
      onReaudit();
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!audit) {
    return (
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Website Audit</h2>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0H3" />
          </svg>
          <p className="text-sm text-gray-500">No audit yet</p>
          <button
            onClick={runAudit}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Audit'}
          </button>
        </div>
      </div>
    );
  }

  const c = audit.checks;
  const loadSecs = c.loadTimeMs != null ? (c.loadTimeMs / 1000).toFixed(1) : null;
  const loadTimeColor = c.loadTimeMs == null ? '' : c.loadTimeMs < 2000 ? 'text-green-600' : c.loadTimeMs < 4000 ? 'text-amber-600' : 'text-red-600';

  const checkRows = [
    { pass: c.isHttps, label: 'SSL / HTTPS', value: c.isHttps ? 'Yes' : 'No' },
    { pass: c.hasMobileViewport, label: 'Mobile Viewport', value: c.hasMobileViewport ? 'Yes' : 'No' },
    { pass: c.hasTitle, label: 'Page Title', value: c.titleText ?? (c.hasTitle ? 'Present' : 'Missing') },
    { pass: c.hasMetaDescription, label: 'Meta Description', value: c.hasMetaDescription ? 'Present' : 'Missing' },
    { pass: c.hasH1, label: 'H1 Tag', value: c.h1Text ?? (c.hasH1 ? 'Present' : 'Missing') },
    { pass: c.hasContactForm, label: 'Contact Form', value: c.hasContactForm ? 'Yes' : 'No' },
    { pass: c.copyrightYear != null, label: 'Copyright', value: c.copyrightYear != null ? String(c.copyrightYear) : 'Missing' },
    { pass: c.brokenImageCount === 0, label: 'Broken Images', value: `${c.brokenImageCount} of ${c.totalImageCount}` },
    { pass: c.hasRobotsTxt, label: 'robots.txt', value: c.hasRobotsTxt ? 'Yes' : 'No' },
  ];

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Website Audit</h2>
        <button
          onClick={runAudit}
          disabled={loading}
          className="rounded-lg border border-border bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Re-audit'}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-5">
        <ScoreRing score={audit.score} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 leading-relaxed">{audit.findings}</p>
          {audit.auditedAt && (
            <p className="mt-1 text-xs text-gray-400">Last audited: {timeAgo(audit.auditedAt)}</p>
          )}
          {loadSecs != null && (
            <p className="mt-1 text-xs">
              Load time: <span className={`font-medium ${loadTimeColor}`}>{loadSecs}s</span>
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mb-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        {expanded ? 'Hide checks' : 'Show checks'}
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {checkRows.map((row) => (
            <CheckRow key={row.label} pass={row.pass} label={row.label} value={row.value} />
          ))}
        </div>
      )}
    </div>
  );
}
