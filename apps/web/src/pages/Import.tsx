import { useState, useRef, type DragEvent } from 'react';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import { api } from '../lib/api.js';
import { useToast } from '../components/ui/Toast.js';

interface ColumnMapping {
  header: string;
  mappedTo: string | null;
}

interface DryRunResult {
  totalRows: number;
  validRows: number;
  newCount: number;
  duplicateCount: number;
  duplicateRows: number[];
  errors: { row: number; field: string; message: string }[];
  preview: Record<string, string>[];
  columnMapping: ColumnMapping[];
}

interface ImportResult {
  inserted: number;
  skippedDuplicates: number;
  errors: { row: number; field: string; message: string }[];
}

const COMPANY_FIELDS = [
  { value: '', label: '-- Skip --' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'Zip' },
  { value: 'industry', label: 'Industry' },
];

export default function Import() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError, showSuccess, ToastComponent } = useToast();

  function parseLocalPreview(text: string) {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return;

    const headerLine = lines[0];
    const hdrs = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    setHeaders(hdrs);

    const rows = lines.slice(1, 11).map((line) => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      fields.push(current.trim());
      return fields;
    });
    setPreviewRows(rows);
  }

  function handleFileRead(file: File) {
    setFileName(file.name);
    setDryRunResult(null);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      parseLocalPreview(text);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileRead(file);
    } else {
      showError('Please upload a CSV file');
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
  }

  async function handleDryRun() {
    if (!csvText) return;
    setLoading(true);
    setImportResult(null);
    try {
      const result = await api<DryRunResult>('/api/import/companies', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText, dryRun: true }),
      });
      setDryRunResult(result);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Dry run failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!csvText) return;
    setLoading(true);
    try {
      const result = await api<ImportResult>('/api/import/companies', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText, dryRun: false }),
      });
      setImportResult(result);
      setDryRunResult(null);
      showSuccess(`Imported ${result.inserted} companies`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCsvText('');
    setFileName('');
    setPreviewRows([]);
    setHeaders([]);
    setDryRunResult(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <TopBar title="Import" subtitle="Import companies from CSV" />

      <div className="p-6 max-w-5xl">
        {/* Upload area */}
        {!csvText && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Drag and drop a CSV file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports .csv files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        )}

        {/* File loaded state */}
        {csvText && (
          <div className="space-y-6">
            {/* File info */}
            <div className="flex items-center justify-between bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{fileName}</p>
                  <p className="text-xs text-gray-500">{previewRows.length} rows previewed, {headers.length} columns</p>
                </div>
              </div>
              <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                Remove
              </button>
            </div>

            {/* Column mapping display */}
            {dryRunResult?.columnMapping && (
              <div className="bg-surface border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Column Mapping</h3>
                <div className="grid grid-cols-2 gap-2">
                  {dryRunResult.columnMapping.map((col, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{col.header}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className={col.mappedTo ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {col.mappedTo || 'Skipped'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-gray-900">Preview (first {previewRows.length} rows)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50">
                        {headers.map((h, i) => (
                          <th key={i} className="text-left px-3 py-2 text-xs uppercase text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-border last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{cell || '--'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dry run results */}
            {dryRunResult && (
              <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Dry Run Results</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{dryRunResult.totalRows}</p>
                    <p className="text-xs text-gray-500">Total Rows</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{dryRunResult.newCount}</p>
                    <p className="text-xs text-gray-500">New Companies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{dryRunResult.duplicateCount}</p>
                    <p className="text-xs text-gray-500">Duplicates (skip)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{dryRunResult.errors.length}</p>
                    <p className="text-xs text-gray-500">Errors</p>
                  </div>
                </div>
                {dryRunResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-600 mb-1">Validation Errors:</p>
                    <ul className="text-xs text-red-500 space-y-1">
                      {dryRunResult.errors.map((err, i) => (
                        <li key={i}>Row {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Import results */}
            {importResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-2">Import Complete</h3>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge label={`${importResult.inserted} imported`} variant="green" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={`${importResult.skippedDuplicates} skipped`} variant="amber" />
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge label={`${importResult.errors.length} errors`} variant="red" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDryRun}
                disabled={loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading && !importResult ? 'Analyzing...' : 'Dry Run'}
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !dryRunResult || dryRunResult.newCount === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loading && dryRunResult ? 'Importing...' : `Import ${dryRunResult?.newCount ?? 0} Companies`}
              </button>
            </div>
          </div>
        )}
      </div>
      {ToastComponent}
    </div>
  );
}
