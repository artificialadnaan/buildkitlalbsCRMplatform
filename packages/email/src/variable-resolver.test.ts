import { describe, it, expect } from 'vitest';
import { resolveVariables, extractVariables } from './variable-resolver.js';

describe('resolveVariables', () => {
  it('replaces simple variables', () => {
    const result = resolveVariables('Hello {{contact.first_name}}!', {
      'contact.first_name': 'John',
    });
    expect(result).toBe('Hello John!');
  });

  it('replaces multiple variables', () => {
    const result = resolveVariables(
      'Hi {{contact.first_name}}, we noticed {{company.name}} at {{company.website}}.',
      {
        'contact.first_name': 'Jane',
        'company.name': 'Acme Corp',
        'company.website': 'acme.com',
      }
    );
    expect(result).toBe('Hi Jane, we noticed Acme Corp at acme.com.');
  });

  it('handles whitespace in variable braces', () => {
    const result = resolveVariables('Hello {{ contact.first_name }}!', {
      'contact.first_name': 'John',
    });
    expect(result).toBe('Hello John!');
  });

  it('replaces unresolved variables with empty string', () => {
    const result = resolveVariables('Hello {{contact.first_name}} from {{missing}}!', {
      'contact.first_name': 'John',
    });
    expect(result).toBe('Hello John from !');
  });

  it('handles template with no variables', () => {
    const result = resolveVariables('No variables here.', {});
    expect(result).toBe('No variables here.');
  });

  it('handles empty template', () => {
    const result = resolveVariables('', { 'contact.first_name': 'John' });
    expect(result).toBe('');
  });
});

describe('extractVariables', () => {
  it('extracts all variable names', () => {
    const vars = extractVariables(
      'Hi {{contact.first_name}}, your company {{company.name}} at {{company.website}}'
    );
    expect(vars).toEqual(['contact.first_name', 'company.name', 'company.website']);
  });

  it('deduplicates repeated variables', () => {
    const vars = extractVariables(
      '{{contact.first_name}} and {{contact.first_name}} again'
    );
    expect(vars).toEqual(['contact.first_name']);
  });

  it('returns empty array for no variables', () => {
    const vars = extractVariables('No variables here.');
    expect(vars).toEqual([]);
  });

  it('trims whitespace from variable names', () => {
    const vars = extractVariables('Hello {{ contact.first_name }}');
    expect(vars).toEqual(['contact.first_name']);
  });
});
