import { useEffect, useState, useRef } from 'react';
import { usePortalAuth } from '../lib/auth.js';
import { portalApi } from '../lib/api.js';
import FileCard from '../components/ui/FileCard.js';

interface FileItem {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  requiresApproval: boolean;
  approvedAt: string | null;
  createdAt: string;
  downloadUrl?: string;
}

export default function Files() {
  const { activeProject } = usePortalAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeProject) return;
    portalApi<FileItem[]>(`/portal/files/${activeProject.id}`).then(setFiles);
  }, [activeProject]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;

    setUploading(true);
    try {
      // Get signed upload URL
      const { file: fileRecord, uploadUrl } = await portalApi<{ file: FileItem; uploadUrl: string }>(
        `/portal/files/${activeProject.id}/upload-url`,
        {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        }
      );

      // Upload directly to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // Refresh file list
      setFiles(prev => [...prev, fileRecord]);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!activeProject) {
    return <div className="text-gray-500 text-center py-20">No project selected.</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-200">Files</h2>
          <p className="text-sm text-gray-500">{activeProject.name}</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500 cursor-pointer ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {files.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-gray-600">
            No files yet. Upload a file to share with the BuildKit team.
          </div>
        ) : (
          files.map(file => (
            <FileCard key={file.id} {...file} />
          ))
        )}
      </div>
    </div>
  );
}
