import { load } from 'cheerio';

interface PostProcessOptions {
  businessName: string;
  industry?: string | null;
  city?: string | null;
  thumbnailUrl: string;
}

const ALLOWED_SCRIPT_PATTERNS = [
  /cdn\.tailwindcss\.com/,
];
const ALLOWED_SCRIPT_IDS = ['tailwind-config'];

export function postProcessHtml(html: string, opts: PostProcessOptions): string {
  const $ = load(html);

  // 1. Inject OG meta tags
  const description = `Check out this custom website preview for ${opts.businessName}${opts.city ? ` in ${opts.city}` : ''}.`;
  $('head').append(`<meta property="og:title" content="${escapeAttr(opts.businessName)}" />`);
  $('head').append(`<meta property="og:description" content="${escapeAttr(description)}" />`);
  $('head').append(`<meta property="og:image" content="${escapeAttr(opts.thumbnailUrl)}" />`);
  $('head').append(`<meta property="og:type" content="website" />`);

  // 2. Append branding footer
  $('body').append(`
    <div style="text-align:center;padding:24px 16px;font-family:sans-serif;font-size:12px;color:#888;border-top:1px solid #eee;margin-top:48px;">
      Preview powered by <a href="https://buildkitlabs.com" style="color:#6366f1;text-decoration:none;font-weight:600;">BuildKit Labs</a> · buildkitlabs.com
    </div>
  `);

  // 3. Sanitize scripts — keep Tailwind CDN + config, strip everything else
  $('script').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    const id = $el.attr('id') || '';

    const isSrcAllowed = ALLOWED_SCRIPT_PATTERNS.some(p => p.test(src));
    const isIdAllowed = ALLOWED_SCRIPT_IDS.includes(id);

    if (!isSrcAllowed && !isIdAllowed) {
      $el.remove();
    }
  });

  // 4. Remove on* event handlers from all elements
  $('*').each((_, el) => {
    const attribs = $(el).attr();
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (attr.toLowerCase().startsWith('on')) {
          $(el).removeAttr(attr);
        }
      }
    }
  });

  // 5. Remove dangerous elements
  $('iframe, object, embed').remove();

  // 6. Remove javascript: URIs
  $('[href], [src], [action]').each((_, el) => {
    const $el = $(el);
    for (const attr of ['href', 'src', 'action']) {
      const val = $el.attr(attr);
      if (val && val.trim().toLowerCase().startsWith('javascript:')) {
        $el.removeAttr(attr);
      }
    }
  });

  return $.html();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
