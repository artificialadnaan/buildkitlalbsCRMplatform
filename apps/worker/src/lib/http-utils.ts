import * as https from 'node:https';
import * as http from 'node:http';
import { URL } from 'node:url';

const REQUEST_TIMEOUT_MS = 8000;

// SSRF protection: block internal/private IPs and cloud metadata
export const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal'];
export const BLOCKED_IP_PREFIXES = [
  '127.', '10.', '0.', '192.168.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '169.254.', '::1', 'fc00:', 'fd00:', 'fe80:',
];

export function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(host)) return true;
    if (BLOCKED_IP_PREFIXES.some(prefix => host.startsWith(prefix))) return true;
    return false;
  } catch {
    return true;
  }
}

export function fetchUrl(url: string): Promise<{ body: string; statusCode: number; elapsed: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BuildKitAuditBot/1.0)',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        // Follow a single redirect
        if (
          res.statusCode != null &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          req.destroy();
          fetchUrl(res.headers.location)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            statusCode: res.statusCode ?? 0,
            elapsed: Date.now() - start,
          });
        });
        res.on('error', reject);
      },
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
  });
}
