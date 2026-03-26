import { useState } from 'react';
import { api } from '../../lib/api.js';

interface AuditChecks {
  loadTimeMs: number | null;
  isHttps: boolean;
  hasMobileViewport: boolean;
  hasTitle: boolean;
  titleText: string | null;
  hasMetaDescription: boolean;
  metaDescription?: string | null;
  hasOgTags?: boolean;
  brokenImageCount: number;
  totalImageCount: number;
  copyrightYear: number | null;
  hasContactForm: boolean;
  hasH1: boolean;
  h1Text: string | null;
  hasRobotsTxt: boolean;
  pagesCrawled: number | string[];
}

export interface WebsiteAudit {
  score: number;
  findings: string;
  checks: AuditChecks;
  auditedAt?: string;
}

interface WebsiteAuditCardProps {
  companyId: string;
  companyWebsite?: string | null;
  audit: WebsiteAudit | null;
  onReaudit: () => void;
}

interface Suggestion {
  icon: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  service: string;
}

function generateSuggestions(checks: AuditChecks): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (!checks.isHttps) {
    suggestions.push({
      icon: 'lock',
      title: 'Install SSL Certificate',
      description: 'Their site lacks HTTPS. This hurts Google rankings and makes visitors see "Not Secure" warnings. We can set up SSL in under an hour.',
      impact: 'high',
      service: 'SSL Setup — $200-500',
    });
  }

  if (!checks.hasMobileViewport) {
    suggestions.push({
      icon: 'smartphone',
      title: 'Make Site Mobile-Friendly',
      description: 'Over 60% of web traffic is mobile. Their site doesn\'t have a mobile viewport — it looks broken on phones. A responsive redesign would dramatically improve their reach.',
      impact: 'high',
      service: 'Responsive Redesign — $2,000-5,000',
    });
  }

  if (checks.loadTimeMs != null && checks.loadTimeMs > 3000) {
    const secs = (checks.loadTimeMs / 1000).toFixed(1);
    suggestions.push({
      icon: 'speed',
      title: `Fix Slow Load Time (${secs}s)`,
      description: `Their homepage takes ${secs}s to load — Google recommends under 3s. Slow sites lose 40% of visitors. Image optimization, caching, and code cleanup can fix this.`,
      impact: 'high',
      service: 'Performance Optimization — $500-1,500',
    });
  }

  if (!checks.hasContactForm) {
    suggestions.push({
      icon: 'contact_mail',
      title: 'Add a Contact Form',
      description: 'No contact form found. They\'re losing leads who want to reach out but won\'t pick up the phone. A simple form can increase conversions 20-30%.',
      impact: 'high',
      service: 'Contact Form + Lead Capture — $300-800',
    });
  }

  if (!checks.hasMetaDescription || !checks.hasTitle) {
    suggestions.push({
      icon: 'search',
      title: 'Fix SEO Meta Tags',
      description: `Missing ${!checks.hasTitle ? 'page title' : ''}${!checks.hasTitle && !checks.hasMetaDescription ? ' and ' : ''}${!checks.hasMetaDescription ? 'meta description' : ''}. These are what show up in Google search results — without them, they\'re invisible to search.`,
      impact: 'medium',
      service: 'SEO Audit + Fix — $500-1,000',
    });
  }

  if (checks.copyrightYear != null && checks.copyrightYear < new Date().getFullYear() - 1) {
    suggestions.push({
      icon: 'update',
      title: `Outdated Copyright (${checks.copyrightYear})`,
      description: `Footer says © ${checks.copyrightYear}. This signals the site hasn't been maintained in years — it erodes trust with potential customers.`,
      impact: 'medium',
      service: 'Site Refresh — $1,000-3,000',
    });
  }

  if (checks.brokenImageCount > 0) {
    suggestions.push({
      icon: 'broken_image',
      title: `${checks.brokenImageCount} Broken Images`,
      description: 'Broken images make the site look unprofessional and abandoned. Quick fix that makes a big visual difference.',
      impact: 'medium',
      service: 'Image Fix + Optimization — $200-500',
    });
  }

  if (!checks.hasRobotsTxt) {
    suggestions.push({
      icon: 'robot_2',
      title: 'Missing robots.txt',
      description: 'No robots.txt file — search engines don\'t know how to crawl the site properly. This is a 5-minute fix that improves SEO.',
      impact: 'low',
      service: 'Quick Technical Fix — $100',
    });
  }

  return suggestions;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  let color = '#ef4444';
  if (score > 60) color = '#22c55e';
  else if (score > 30) color = '#f59e0b';

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <span className="text-2xl font-black text-white">{score}</span>
        <p className="text-[8px] text-slate-400 uppercase tracking-wider">/ 100</p>
      </div>
    </div>
  );
}

const impactColors = {
  high: 'bg-red-500/20 text-red-400 border-red-500',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function WebsiteAuditCard({ companyId, companyWebsite, audit, onReaudit }: WebsiteAuditCardProps) {
  const [loading, setLoading] = useState(false);
  const [showAllChecks, setShowAllChecks] = useState(false);

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
      <div className="bg-slate-900 rounded-xl p-8 text-white">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">monitoring</span>
          Website Audit
        </h2>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-600">web</span>
          <p className="text-sm text-slate-400">No audit data yet</p>
          {companyWebsite && (
            <button
              onClick={runAudit}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-lg font-bold text-sm shadow-lg hover:-translate-y-px transition-all disabled:opacity-50"
            >
              {loading ? 'Scanning...' : 'Run Website Audit'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const c = audit.checks;
  const suggestions = generateSuggestions(c);
  const loadSecs = c.loadTimeMs != null ? (c.loadTimeMs / 1000).toFixed(1) : null;
  const screenshotUrl = companyWebsite
    ? `https://image.thum.io/get/width/600/crop/400/${companyWebsite.startsWith('http') ? companyWebsite : 'https://' + companyWebsite}`
    : null;

  const checkRows = [
    { pass: c.isHttps, label: 'SSL / HTTPS', value: c.isHttps ? 'Secure' : 'Not Secure' },
    { pass: c.hasMobileViewport, label: 'Mobile-Friendly', value: c.hasMobileViewport ? 'Yes' : 'No' },
    { pass: c.hasTitle, label: 'Page Title', value: c.titleText ?? (c.hasTitle ? 'Present' : 'Missing') },
    { pass: c.hasMetaDescription, label: 'Meta Description', value: c.hasMetaDescription ? 'Present' : 'Missing' },
    { pass: c.hasH1, label: 'H1 Tag', value: c.h1Text ?? (c.hasH1 ? 'Present' : 'Missing') },
    { pass: c.hasContactForm, label: 'Contact Form', value: c.hasContactForm ? 'Found' : 'Missing' },
    { pass: c.copyrightYear != null && c.copyrightYear >= new Date().getFullYear() - 1, label: 'Copyright', value: c.copyrightYear != null ? `© ${c.copyrightYear}` : 'Missing' },
    { pass: c.brokenImageCount === 0, label: 'Broken Images', value: c.brokenImageCount === 0 ? 'None' : `${c.brokenImageCount} found` },
    { pass: c.hasRobotsTxt, label: 'robots.txt', value: c.hasRobotsTxt ? 'Present' : 'Missing' },
  ];

  return (
    <div className="space-y-6">
      {/* Main Audit Card */}
      <div className="bg-slate-900 rounded-xl overflow-hidden">
        {/* Screenshot + Score Header */}
        <div className="flex">
          {/* Screenshot */}
          {screenshotUrl && (
            <div className="w-1/2 relative">
              <img
                src={screenshotUrl}
                alt="Website screenshot"
                className="w-full h-64 object-cover object-top"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900/80" />
              <div className="absolute bottom-3 left-3">
                <a
                  href={companyWebsite?.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-white/60 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  Visit Site
                </a>
              </div>
            </div>
          )}

          {/* Score + Summary */}
          <div className={`${screenshotUrl ? 'w-1/2' : 'w-full'} p-8 flex flex-col justify-center`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">monitoring</span>
                Website Health
              </h2>
              <button
                onClick={runAudit}
                disabled={loading}
                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 uppercase tracking-widest disabled:opacity-50"
              >
                {loading ? 'Scanning...' : 'Re-scan'}
              </button>
            </div>
            <div className="flex items-center gap-6">
              <ScoreRing score={audit.score} />
              <div className="flex-1">
                <p className="text-sm text-slate-300 leading-relaxed">{audit.findings}</p>
                {audit.auditedAt && (
                  <p className="mt-2 text-[10px] text-slate-500">Scanned {timeAgo(audit.auditedAt)}</p>
                )}
                {loadSecs && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Load time: <span className={`font-bold ${parseFloat(loadSecs) < 3 ? 'text-green-400' : 'text-red-400'}`}>{loadSecs}s</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Check Grid */}
        <div className="px-8 pb-6">
          <button
            onClick={() => setShowAllChecks(v => !v)}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-300 uppercase tracking-widest flex items-center gap-1 mb-4"
          >
            <span className="material-symbols-outlined text-xs">{showAllChecks ? 'expand_less' : 'expand_more'}</span>
            {showAllChecks ? 'Hide' : 'Show'} Technical Checks
          </button>
          {showAllChecks && (
            <div className="grid grid-cols-3 gap-3">
              {checkRows.map(row => (
                <div key={row.label} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                  <span className={`material-symbols-outlined text-sm ${row.pass ? 'text-green-400' : 'text-red-400'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {row.pass ? 'check_circle' : 'cancel'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400">{row.label}</p>
                    <p className="text-xs font-bold text-white truncate">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Improvement Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">lightbulb</span>
            What We Can Improve ({suggestions.length} opportunities)
          </h3>
          <div className="space-y-4">
            {suggestions.map((s, i) => (
              <div key={i} className={`p-5 rounded-lg border-l-4 ${impactColors[s.impact]} bg-opacity-5`} style={{ backgroundColor: 'rgb(249 249 255)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="material-symbols-outlined text-lg text-slate-600 mt-0.5">{s.icon}</span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${impactColors[s.impact]}`}>
                      {s.impact} impact
                    </span>
                    <p className="text-[10px] font-bold text-orange-700 mt-2">{s.service}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
