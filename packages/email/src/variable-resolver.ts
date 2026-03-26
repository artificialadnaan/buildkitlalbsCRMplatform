/**
 * Resolves {{variable}} placeholders in a template string.
 *
 * Supports nested keys like {{contact.first_name}}.
 * Unresolved variables are replaced with empty string.
 */
export function resolveVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key: string) => {
    const trimmed = key.trim();
    return variables[trimmed] ?? '';
  });
}

/**
 * Extracts all {{variable}} names from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\s*[\w.]+\s*)\}\}/g);
  const vars = new Set<string>();
  for (const match of Array.from(matches)) {
    vars.add(match[1].trim());
  }
  return Array.from(vars);
}
