interface PromptInput {
  name: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  googleRating?: string | null;
  phone?: string | null;
  address?: string | null;
  reviewCount?: number | null;
  websiteAuditFindings?: string | null;
}

const STYLE_MAP: Record<string, string> = {
  restaurant: 'warm colors, appetizing food photography vibe, clean modern layout',
  food: 'warm colors, appetizing food photography vibe, clean modern layout',
  cafe: 'warm, cozy coffee shop aesthetic with earthy tones',
  pizza: 'warm colors, appetizing food photography vibe, clean modern layout',
  bakery: 'warm, artisanal aesthetic with soft pastry colors',
  contractor: 'professional, trustworthy blue/gray tones with strong typography',
  construction: 'professional, trustworthy blue/gray tones with bold geometric shapes',
  roofing: 'professional, dependable feel with sky-blue accents and strong CTAs',
  plumbing: 'professional, clean blue palette with modern utility feel',
  hvac: 'professional, clean blue palette with temperature-themed accents',
  electrical: 'professional, safety-focused with yellow/amber accents',
  landscaping: 'natural greens and earth tones with outdoor photography',
  painting: 'colorful, creative palette showcasing transformations',
  salon: 'elegant, luxurious with soft pastels and gold accents',
  beauty: 'elegant, luxurious with soft pastels and gold accents',
  spa: 'calming, zen-like with soft neutrals and natural textures',
  barber: 'bold, masculine aesthetic with dark tones and sharp typography',
};

function getStyleDirection(industry: string | null | undefined): string {
  if (!industry) return 'clean, modern, professional design with strong visual hierarchy';
  const norm = industry.toLowerCase();
  for (const [keyword, style] of Object.entries(STYLE_MAP)) {
    if (norm.includes(keyword)) return style;
  }
  return 'clean, modern, professional design with strong visual hierarchy';
}

function getIndustrySections(industry: string | null | undefined): string {
  if (!industry) return 'services overview, about section';
  const norm = industry.toLowerCase();
  if (['restaurant', 'food', 'cafe', 'pizza', 'bakery'].some(k => norm.includes(k))) {
    return 'menu highlights, photo gallery, hours of operation';
  }
  if (['contractor', 'construction', 'roofing', 'plumbing', 'hvac', 'electrical', 'landscaping', 'painting'].some(k => norm.includes(k))) {
    return 'services list with icons, project gallery, licensing/insurance badges, service area';
  }
  if (['salon', 'beauty', 'spa', 'barber', 'nails', 'hair'].some(k => norm.includes(k))) {
    return 'services menu with pricing, before/after gallery, booking section';
  }
  return 'services overview, about section, key differentiators';
}

export function buildStitchPrompt(input: PromptInput): string {
  const {
    name, industry, city, state, googleRating,
    phone, address, reviewCount, websiteAuditFindings,
  } = input;

  const location = [city, state].filter(Boolean).join(', ') || 'the local area';
  const industryLabel = industry ?? 'local business';
  const style = getStyleDirection(industry);
  const sections = getIndustrySections(industry);

  let prompt = `A production-ready, full-width, mobile-friendly landing page for "${name}" — a ${industryLabel} in ${location}. This must be a complete, polished website page — NOT a wireframe, NOT a design mockup, NOT a narrow preview. It should look like a real, live business website with full-width sections, real content, and professional layout that fills the entire screen.`;

  if (googleRating && reviewCount) {
    prompt += ` ${googleRating} stars from ${reviewCount} Google reviews.`;
  } else if (googleRating) {
    prompt += ` Rated ${googleRating} stars on Google.`;
  }

  prompt += `\n\nInclude: hero section with business name and tagline, `;
  if (googleRating) prompt += `star rating badge, `;
  prompt += `${sections}, customer testimonial quotes, `;
  prompt += `contact info (`;
  if (phone) prompt += `phone: ${phone}, `;
  if (address) prompt += `address: ${address}, `;
  prompt += `${location}), and a prominent "Call Now" CTA button.`;

  if (websiteAuditFindings) {
    prompt += `\n\nThis business's current website has these issues: ${websiteAuditFindings}. Make sure the new design specifically addresses these weaknesses.`;
  }

  prompt += `\n\nStyle: ${style}. The page should feel like a premium ${industryLabel} website, not a template. Make it unique and memorable. Use full-width hero images, edge-to-edge sections, and real placeholder photography. No dotted backgrounds, no wireframe elements, no narrow centered columns — this needs to look like a finished, deployed website.`;

  return prompt;
}
