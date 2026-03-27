/**
 * Generate a URL-safe slug from company name and city.
 * Optional companyId suffix for collision avoidance.
 */
export function generateSlug(name: string, city: string | null, companyIdSuffix?: string): string {
  const parts = [name, city].filter(Boolean).join('-');
  let slug = parts
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (companyIdSuffix) {
    slug += `-${companyIdSuffix.slice(0, 6)}`;
  }

  return slug;
}
