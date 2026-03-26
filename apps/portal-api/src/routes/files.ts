import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, files, projects } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';
import { getUploadUrl, getDownloadUrl, generateR2Key, getMaxFileSize } from '../lib/r2.js';

const router = Router();

router.use(portalAuthMiddleware);

// List files for a project
router.get('/:projectId', async (req, res) => {
  const companyId = req.portalUser!.companyId;
  const { projectId } = req.params;

  // Verify project belongs to this company
  const [project] = await db.select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const projectFiles = await db.select()
    .from(files)
    .where(eq(files.projectId, projectId));

  // Generate download URLs for each file
  const filesWithUrls = await Promise.all(projectFiles.map(async (file) => {
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await getDownloadUrl(file.r2Key);
    } catch {
      // R2 might not be configured in dev
    }
    return { ...file, downloadUrl };
  }));

  res.json(filesWithUrls);
});

// Request a signed upload URL
router.post('/:projectId/upload-url', async (req, res) => {
  const companyId = req.portalUser!.companyId;
  const { projectId } = req.params;
  const { filename, contentType, sizeBytes } = req.body;

  if (!filename || !contentType) {
    res.status(400).json({ error: 'filename and contentType are required' });
    return;
  }

  if (sizeBytes && sizeBytes > getMaxFileSize()) {
    res.status(400).json({ error: 'File exceeds maximum size of 50MB' });
    return;
  }

  // Verify project belongs to this company
  const [project] = await db.select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const r2Key = generateR2Key(projectId, filename);

  let uploadUrl: string;
  try {
    uploadUrl = await getUploadUrl(r2Key, contentType);
  } catch (err) {
    console.error('Failed to generate upload URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
    return;
  }

  // Create file record in database
  const [file] = await db.insert(files).values({
    projectId,
    uploadedBy: req.portalUser!.contactId,
    filename,
    r2Key,
    sizeBytes: sizeBytes || 0,
    mimeType: contentType,
    requiresApproval: false,
  }).returning();

  res.status(201).json({ file, uploadUrl });
});

// Request approval for a file (team-side route, but included here for completeness)
router.post('/:projectId/files/:fileId/request-approval', async (req, res) => {
  const { fileId } = req.params;

  const [file] = await db.update(files)
    .set({ requiresApproval: true })
    .where(eq(files.id, fileId))
    .returning();

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.json(file);
});

export default router;
