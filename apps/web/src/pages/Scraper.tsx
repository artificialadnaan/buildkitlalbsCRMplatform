import { useEffect, useState, useCallback, useRef } from 'react';
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

// Major Texas cities with zip code ranges for quick-add
const CITY_PRESETS = [
  { name: 'Dallas', zips: ['75201', '75202', '75203', '75204', '75205', '75206', '75207', '75208', '75209', '75210', '75211', '75212', '75214', '75215', '75216', '75217', '75218', '75219', '75220', '75223', '75224', '75225', '75226', '75227', '75228', '75229', '75230', '75231', '75232', '75233', '75234', '75235', '75236', '75237', '75238', '75240', '75241', '75242', '75243', '75244', '75246', '75247', '75248', '75249', '75250', '75251', '75252', '75253', '75254'] },
  { name: 'Fort Worth', zips: ['76101', '76102', '76103', '76104', '76105', '76106', '76107', '76108', '76109', '76110', '76111', '76112', '76113', '76114', '76115', '76116', '76117', '76118', '76119', '76120', '76121', '76122', '76123', '76124', '76126', '76127', '76129', '76130', '76131', '76132', '76133', '76134', '76135', '76136', '76137', '76140'] },
  { name: 'Austin', zips: ['73301', '73344', '78701', '78702', '78703', '78704', '78705', '78712', '78717', '78719', '78721', '78722', '78723', '78724', '78725', '78726', '78727', '78728', '78729', '78730', '78731', '78732', '78733', '78734', '78735', '78736', '78737', '78738', '78739', '78741', '78742', '78744', '78745', '78746', '78747', '78748', '78749', '78750', '78751', '78752', '78753', '78754', '78756', '78757', '78758', '78759'] },
  { name: 'Houston', zips: ['77001', '77002', '77003', '77004', '77005', '77006', '77007', '77008', '77009', '77010', '77011', '77012', '77013', '77014', '77015', '77016', '77017', '77018', '77019', '77020', '77021', '77022', '77023', '77024', '77025', '77026', '77027', '77028', '77029', '77030', '77031', '77032', '77033', '77034', '77035', '77036', '77037', '77038', '77039', '77040', '77041', '77042', '77043', '77044', '77045', '77046', '77047', '77048', '77049', '77050', '77051', '77053', '77054', '77055', '77056', '77057', '77058', '77059', '77060', '77061', '77062', '77063', '77064', '77065', '77066', '77067', '77068', '77069', '77070', '77071', '77072', '77073', '77074', '77075', '77076', '77077', '77078', '77079', '77080', '77081', '77082', '77083', '77084', '77085', '77086', '77087', '77088', '77089', '77090', '77091', '77092', '77093', '77094', '77095', '77096', '77098', '77099'] },
  { name: 'San Antonio', zips: ['78201', '78202', '78203', '78204', '78205', '78206', '78207', '78208', '78209', '78210', '78211', '78212', '78213', '78214', '78215', '78216', '78217', '78218', '78219', '78220', '78221', '78222', '78223', '78224', '78225', '78226', '78227', '78228', '78229', '78230', '78231', '78232', '78233', '78234', '78235', '78236', '78237', '78238', '78239', '78240', '78242', '78243', '78244', '78245', '78246', '78247', '78248', '78249', '78250', '78251', '78252', '78253', '78254', '78255', '78256', '78257', '78258', '78259', '78260', '78261', '78263', '78264', '78266'] },
  { name: 'Plano', zips: ['75023', '75024', '75025', '75026', '75074', '75075', '75086', '75093'] },
  { name: 'Arlington', zips: ['76001', '76002', '76003', '76004', '76005', '76006', '76007', '76010', '76011', '76012', '76013', '76014', '76015', '76016', '76017', '76018', '76019'] },
  { name: 'Frisco', zips: ['75033', '75034', '75035'] },
  { name: 'McKinney', zips: ['75069', '75070', '75071', '75072'] },
  { name: 'Irving', zips: ['75014', '75015', '75016', '75017', '75038', '75039', '75060', '75061', '75062', '75063'] },
];

const BUSINESS_CATEGORIES = [
  'All Businesses',
  'Restaurants',
  'Plumbers',
  'Electricians',
  'Roofing Contractors',
  'HVAC',
  'Landscaping',
  'Auto Repair',
  'Dentists',
  'Real Estate Agents',
  'General Contractors',
  'Home Cleaning',
  'Personal Trainers',
  'Salons & Barbershops',
  'Accounting & Tax',
  'Legal Services',
];

export default function Scraper() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [selectedZips, setSelectedZips] = useState<Set<string>>(new Set());
  const [manualZipInput, setManualZipInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Businesses');
  const [customQuery, setCustomQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'cities' | 'manual' | 'map'>('cities');
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [mapPin, setMapPin] = useState<{ lat: number; lng: number } | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api<{ data: ScrapeJob[] }>('/api/scrape/jobs');
      setJobs(res.data);
    } catch {
      // Silently fail on poll
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  function addManualZips() {
    const newZips = manualZipInput
      .split(/[,\s\n]+/)
      .map(z => z.trim())
      .filter(z => /^\d{5}$/.test(z));

    if (newZips.length > 0) {
      setSelectedZips(prev => {
        const next = new Set(prev);
        newZips.forEach(z => next.add(z));
        return next;
      });
      setManualZipInput('');
    }
  }

  function toggleCity(cityName: string) {
    const city = CITY_PRESETS.find(c => c.name === cityName);
    if (!city) return;

    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(cityName)) {
        next.delete(cityName);
        // Remove city's zips
        setSelectedZips(prevZips => {
          const nextZips = new Set(prevZips);
          city.zips.forEach(z => nextZips.delete(z));
          return nextZips;
        });
      } else {
        next.add(cityName);
        // Add city's zips
        setSelectedZips(prevZips => {
          const nextZips = new Set(prevZips);
          city.zips.forEach(z => nextZips.add(z));
          return nextZips;
        });
      }
      return next;
    });
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Map to approximate Texas coords (simplified)
    const lat = 34.0 - (y * 8.0);  // ~26-34 lat
    const lng = -106.0 + (x * 12.0); // ~-106 to -94 lng
    setMapPin({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const zipCodes = Array.from(selectedZips);
    if (zipCodes.length === 0) {
      setError('Select at least one city or add zip codes to search');
      return;
    }

    const searchQuery = selectedCategory === 'All Businesses' ? (customQuery.trim() || 'businesses') : selectedCategory.toLowerCase();

    setSubmitting(true);
    try {
      await api('/api/scrape', {
        method: 'POST',
        body: JSON.stringify({ zipCodes, searchQuery }),
      });
      setSelectedZips(new Set());
      setSelectedCities(new Set());
      setCustomQuery('');
      setSelectedCategory('All Businesses');
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

  function removeZip(zip: string) {
    setSelectedZips(prev => {
      const next = new Set(prev);
      next.delete(zip);
      return next;
    });
  }

  const filteredCities = CITY_PRESETS.filter(c =>
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  return (
    <div>
      <TopBar
        title="Lead Scraper"
        subtitle={`${selectedZips.size} zip codes selected`}
      />

      <div className="p-8">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Location selection */}
            <div className="lg:col-span-2 space-y-5">
              {/* Location tabs */}
              <div className="card overflow-hidden">
                <div className="flex border-b border-gray-100">
                  {(['cities', 'manual', 'map'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab
                          ? 'text-brand-600 border-b-2 border-brand-500 bg-brand-50/30'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab === 'cities' && 'Select Cities'}
                      {tab === 'manual' && 'Enter Zip Codes'}
                      {tab === 'map' && 'Drop a Pin'}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* Cities Tab */}
                  {activeTab === 'cities' && (
                    <div>
                      <div className="mb-4">
                        <input
                          type="text"
                          value={citySearch}
                          onChange={e => setCitySearch(e.target.value)}
                          placeholder="Search cities..."
                          className="input-field"
                        />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {filteredCities.map(city => (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => toggleCity(city.name)}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all border ${
                              selectedCities.has(city.name)
                                ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm'
                                : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <span>{city.name}</span>
                            <span className={`text-xs ${selectedCities.has(city.name) ? 'text-brand-500' : 'text-gray-400'}`}>
                              {city.zips.length} zips
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Zip Tab */}
                  {activeTab === 'manual' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        Enter zip codes (comma, space, or newline separated)
                      </label>
                      <div className="flex gap-3">
                        <textarea
                          value={manualZipInput}
                          onChange={e => setManualZipInput(e.target.value)}
                          placeholder={"75201, 75202, 75203\nOr paste a list..."}
                          rows={4}
                          className="input-field resize-none flex-1"
                        />
                        <button
                          type="button"
                          onClick={addManualZips}
                          className="btn-primary self-end"
                        >
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {manualZipInput.split(/[,\s\n]+/).filter(z => /^\d{5}$/.test(z.trim())).length} valid zip(s) ready to add
                      </p>
                    </div>
                  )}

                  {/* Map Tab */}
                  {activeTab === 'map' && (
                    <div>
                      <p className="text-xs text-gray-500 mb-3">
                        Click anywhere on the map to drop a pin, then adjust the radius to capture surrounding zip codes.
                      </p>
                      <div
                        ref={mapRef}
                        onClick={handleMapClick}
                        className="relative w-full h-72 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 cursor-crosshair overflow-hidden"
                      >
                        {/* Texas outline approximation */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg viewBox="0 0 400 350" className="w-full h-full opacity-10">
                            <path d="M100,20 L200,20 L200,80 L350,80 L350,120 L300,120 L280,180 L320,250 L280,300 L220,330 L180,280 L140,300 L100,280 L80,200 L60,160 L80,100 Z" fill="currentColor" className="text-gray-900" />
                          </svg>
                        </div>

                        {/* Grid overlay */}
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
                          backgroundSize: '40px 40px',
                        }} />

                        {/* Pin marker */}
                        {mapPin && (
                          <div
                            className="absolute transform -translate-x-1/2 -translate-y-full"
                            style={{
                              left: `${((mapPin.lng + 106) / 12) * 100}%`,
                              top: `${((34 - mapPin.lat) / 8) * 100}%`,
                            }}
                          >
                            {/* Radius circle */}
                            <div
                              className="absolute rounded-full bg-brand-500/10 border-2 border-brand-400/30 animate-pulse"
                              style={{
                                width: `${radiusMiles * 8}px`,
                                height: `${radiusMiles * 8}px`,
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                              }}
                            />
                            {/* Pin */}
                            <svg className="h-8 w-8 text-brand-600 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                          </div>
                        )}

                        {/* Click instructions */}
                        {!mapPin && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <svg className="h-10 w-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                              <p className="text-sm text-gray-400">Click to drop a pin</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Radius slider */}
                      {mapPin && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-500">Search Radius</label>
                            <span className="text-sm font-semibold text-brand-600">{radiusMiles} miles</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={50}
                            value={radiusMiles}
                            onChange={e => setRadiusMiles(parseInt(e.target.value))}
                            className="w-full accent-brand-500"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>1 mi</span>
                            <span>25 mi</span>
                            <span>50 mi</span>
                          </div>
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100">
                            <svg className="h-4 w-4 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                            </svg>
                            <p className="text-xs text-brand-700">
                              Pin at {mapPin.lat}, {mapPin.lng} — Radius covers ~{Math.round(Math.PI * radiusMiles * radiusMiles)} sq miles.
                              Zip codes within this area will be automatically included.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Zips Display */}
              {selectedZips.size > 0 && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {selectedZips.size} Zip Codes Selected
                    </h4>
                    <button
                      type="button"
                      onClick={() => { setSelectedZips(new Set()); setSelectedCities(new Set()); }}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {Array.from(selectedZips).sort().map(zip => (
                      <span
                        key={zip}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs text-gray-600"
                      >
                        {zip}
                        <button
                          type="button"
                          onClick={() => removeZip(zip)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Category & Submit */}
            <div className="space-y-5">
              {/* Business Category */}
              <div className="card p-5">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Business Type</h4>
                <p className="text-xs text-gray-400 mb-4">
                  Select a category or type a custom search term
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {BUSINESS_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setCustomQuery(''); }}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all ${
                        selectedCategory === cat
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Custom Search</label>
                  <input
                    type="text"
                    value={customQuery}
                    onChange={e => { setCustomQuery(e.target.value); setSelectedCategory('All Businesses'); }}
                    placeholder='e.g., "yoga studios"'
                    className="input-field"
                  />
                </div>
              </div>

              {/* Cost Estimate */}
              <div className="card p-5 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-sm font-medium text-gray-700">Estimated Cost</h4>
                </div>
                <p className="text-xs text-gray-500">
                  ~$34 per 1,000 leads via Google Places API.
                  {selectedZips.size > 0 && (
                    <span className="block mt-1 text-gray-400">
                      Searching {selectedZips.size} zip codes for {selectedCategory === 'All Businesses' && customQuery ? customQuery : selectedCategory.toLowerCase()}.
                    </span>
                  )}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || selectedZips.size === 0}
                className="btn-primary w-full py-3 text-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Starting Scrape...
                  </span>
                ) : (
                  `Scrape ${selectedZips.size} Zip Code${selectedZips.size !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Job History */}
        <div className="mt-8">
          <div className="card p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5 tracking-tight">Scrape History</h3>

            {jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="rounded-full bg-gray-50 p-3">
                  <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">No scrape jobs yet. Configure your search above and start scraping.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div key={job.id} className="rounded-xl bg-gray-50/50 border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          &ldquo;{job.searchQuery}&rdquo;
                        </span>
                        <span className="text-xs text-gray-400">
                          {job.zipCodes.length} zip{job.zipCodes.length !== 1 ? 's' : ''}
                        </span>
                        <Badge label={job.status} variant={STATUS_VARIANTS[job.status]} />
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {(job.status === 'running' || job.status === 'pending') && (
                      <div className="mb-3">
                        <ProgressBar
                          value={job.status === 'pending' ? 0 : ((job.totalFound > 0 ? 50 : 10))}
                          label={job.status === 'pending' ? 'Waiting to start...' : 'Scraping in progress...'}
                          color={job.status === 'pending' ? 'bg-amber-500' : 'bg-brand-500'}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Found:</span>{' '}
                        <span className="text-gray-900 font-medium">{job.totalFound}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">New Leads:</span>{' '}
                        <span className="text-emerald-600 font-medium">{job.newLeads}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Duplicates:</span>{' '}
                        <span className="text-gray-400">{job.duplicatesSkipped}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Duration:</span>{' '}
                        <span className="text-gray-500">
                          {formatDuration(job.startedAt, job.completedAt)}
                        </span>
                      </div>
                    </div>

                    {job.errorMessage && (
                      <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        {job.errorMessage}
                      </div>
                    )}

                    {job.status === 'done' && (
                      <div className="mt-2 text-xs text-gray-400">
                        Zip codes: {job.zipCodes.slice(0, 10).join(', ')}{job.zipCodes.length > 10 ? ` +${job.zipCodes.length - 10} more` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
