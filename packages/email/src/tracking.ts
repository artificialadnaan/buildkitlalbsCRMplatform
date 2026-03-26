/**
 * Injects email open/click tracking into HTML email bodies.
 *
 * - Appends a 1x1 tracking pixel before closing body tag (or at end of HTML)
 * - Rewrites all anchor href links to go through the click tracker
 */
export function injectTracking(html: string, emailSendId: string, apiBaseUrl: string): string {
  const trackingBase = `${apiBaseUrl}/t/${emailSendId}`;

  // Rewrite anchor href links to go through click tracker
  // Matches href="..." in anchor tags, skipping mailto: and # links
  let tracked = html.replace(
    /<a\s([^>]*?)href="([^"]+)"([^>]*?)>/gi,
    (match, before: string, url: string, after: string) => {
      // Skip mailto, tel, anchor, and tracking URLs (avoid double-wrapping)
      if (
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('#') ||
        url.includes('/t/' + emailSendId + '/')
      ) {
        return match;
      }
      const encodedUrl = encodeURIComponent(url);
      return `<a ${before}href="${trackingBase}/click?url=${encodedUrl}"${after}>`;
    }
  );

  // Append tracking pixel
  const pixel = `<img src="${trackingBase}/open.png" width="1" height="1" style="display:none" alt="" />`;

  if (tracked.includes('</body>')) {
    tracked = tracked.replace('</body>', `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}
