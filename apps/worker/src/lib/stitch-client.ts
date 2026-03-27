// apps/worker/src/lib/stitch-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface StitchScreen {
  screenId: string;
  title: string;
  htmlDownloadUrl: string;
  screenshotDownloadUrl: string;
}

interface GenerateResult {
  html: string;
  screenshotBuffer: Buffer;
  screenId: string;
}

let clientInstance: Client | null = null;

async function getClient(): Promise<Client> {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) throw new Error('[stitch] STITCH_API_KEY env var is required');

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL('https://stitch.googleapis.com/mcp'),
      {
        requestInit: {
          headers: { 'X-Goog-Api-Key': apiKey },
        },
      },
    );

    const client = new Client({ name: 'buildkit-worker', version: '1.0.0' });
    await client.connect(transport);
    clientInstance = client;
    return client;
  } catch (err) {
    clientInstance = null; // Reset on connection failure so next call retries
    throw err;
  }
}

/** Reset the MCP client — call on connection errors to force reconnect */
export function resetClient(): void {
  clientInstance = null;
}

function getProjectId(): string {
  const projectId = process.env.STITCH_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      '[stitch] STITCH_PROJECT_ID is not set. Create a project first:\n' +
      '  1. Use Stitch MCP create_project tool with title "BuildKit Prospect Previews"\n' +
      '  2. Set STITCH_PROJECT_ID=<projectId> in your environment'
    );
  }
  return projectId;
}

/**
 * List all current screen IDs in the project.
 */
async function listScreenIds(client: Client, projectId: string): Promise<Map<string, StitchScreen>> {
  const result = await client.callTool({
    name: 'list_screens',
    arguments: { projectId },
  }, undefined, { timeout: 60_000 });

  const screens = new Map<string, StitchScreen>();
  // Parse the response — list_screens returns JSON with a screens array
  const contentArr = result.content as Array<{ type: string; text?: string }>;
  console.log(`[stitch] list_screens raw content (${contentArr.length} blocks):`, JSON.stringify(contentArr).slice(0, 500));
  const text = contentArr.find(c => c.type === 'text')?.text;
  if (!text) {
    console.log('[stitch] No text content found in list_screens response');
    return screens;
  }
  console.log(`[stitch] list_screens text (${text.length} chars):`, text.slice(0, 300));

  try {
    const parsed = JSON.parse(text);
    const arr = parsed.screens ?? [];
    for (const s of arr) {
      const idMatch = s.name?.match(/screens\/(.+)$/);
      if (idMatch) {
        screens.set(idMatch[1], {
          screenId: idMatch[1],
          title: s.title ?? '',
          htmlDownloadUrl: s.htmlCode?.downloadUrl ?? '',
          screenshotDownloadUrl: s.screenshot?.downloadUrl ?? '',
        });
      }
    }
  } catch {
    // empty or unparseable
  }
  return screens;
}

/**
 * Generate a preview page via Stitch and return the HTML + screenshot.
 *
 * Flow:
 * 1. Snapshot existing screen IDs
 * 2. Call generate_screen_from_text
 * 3. Poll list_screens until a new screen appears (max 5 min)
 * 4. Download HTML + screenshot from the new screen
 */
export async function generatePreview(prompt: string, modelId = 'GEMINI_3_1_PRO'): Promise<GenerateResult> {
  const client = await getClient();
  const projectId = getProjectId();

  // 1. Snapshot existing screens
  const existingScreens = await listScreenIds(client, projectId);

  // 2. Generate (5 min timeout — Stitch generation takes 3-5 min)
  await client.callTool({
    name: 'generate_screen_from_text',
    arguments: {
      projectId,
      prompt,
      deviceType: 'MOBILE',
      modelId,
    },
  }, undefined, { timeout: 300_000 });

  // 3. Poll for new screen
  const POLL_INTERVAL_MS = 15_000;
  const MAX_POLLS = 20; // 5 minutes total
  let newScreen: StitchScreen | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const current = await listScreenIds(client, projectId);

    for (const [id, screen] of current) {
      if (!existingScreens.has(id) && screen.htmlDownloadUrl) {
        newScreen = screen;
        break;
      }
    }
    if (newScreen) break;
    console.log(`[stitch] Polling for screen... attempt ${i + 1}/${MAX_POLLS}`);
  }

  if (!newScreen) {
    throw new Error('[stitch] Screen did not appear after 5 minutes of polling');
  }

  // 4. Download HTML + screenshot
  const [htmlResponse, screenshotResponse] = await Promise.all([
    fetch(newScreen.htmlDownloadUrl),
    fetch(newScreen.screenshotDownloadUrl),
  ]);

  if (!htmlResponse.ok) throw new Error(`[stitch] Failed to download HTML: ${htmlResponse.status}`);
  if (!screenshotResponse.ok) throw new Error(`[stitch] Failed to download screenshot: ${screenshotResponse.status}`);

  const html = await htmlResponse.text();
  const screenshotBuffer = Buffer.from(await screenshotResponse.arrayBuffer());

  return { html, screenshotBuffer, screenId: newScreen.screenId };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
