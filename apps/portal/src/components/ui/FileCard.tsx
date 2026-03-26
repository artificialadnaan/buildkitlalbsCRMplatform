interface FileCardProps {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  requiresApproval: boolean;
  approvedAt: string | null;
  createdAt: string;
  downloadUrl?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fileIcons: Record<string, string> = {
  'image/': '\uD83D\uDDBC\uFE0F',
  'application/pdf': '\uD83D\uDCC4',
  'application/zip': '\uD83D\uDCE6',
  'text/': '\uD83D\uDCDD',
};

function getFileIcon(mimeType: string): string {
  for (const [prefix, icon] of Object.entries(fileIcons)) {
    if (mimeType.startsWith(prefix)) return icon;
  }
  return '\uD83D\uDCCE';
}

export default function FileCard({ filename, sizeBytes, mimeType, requiresApproval, approvedAt, createdAt, downloadUrl }: FileCardProps) {
  const approvalBadge = requiresApproval
    ? approvedAt
      ? { label: 'Approved', color: 'bg-green-500/15 text-green-500' }
      : { label: 'Pending Approval', color: 'bg-amber-500/15 text-amber-500' }
    : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex items-start gap-3 hover:border-gray-600 transition">
      <div className="text-2xl">{getFileIcon(mimeType)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-300 truncate">{filename}</div>
        <div className="text-xs text-gray-600 mt-0.5">
          {formatFileSize(sizeBytes)} · {new Date(createdAt).toLocaleDateString()}
        </div>
        {approvalBadge && (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1.5 ${approvalBadge.color}`}>
            {approvalBadge.label}
          </span>
        )}
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0"
        >
          Download
        </a>
      )}
    </div>
  );
}
