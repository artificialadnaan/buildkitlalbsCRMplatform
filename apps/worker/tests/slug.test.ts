import { describe, it, expect } from 'vitest';
import { generateSlug } from '../src/lib/slug.js';

describe('generateSlug', () => {
  it('creates slug from name and city', () => {
    expect(generateSlug("Sal's Pizza", 'Arlington')).toBe('sals-pizza-arlington');
  });

  it('lowercases and strips special characters', () => {
    expect(generateSlug('Joe & Sons HVAC!!!', 'Fort Worth')).toBe('joe-sons-hvac-fort-worth');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('A--B  C', 'D')).toBe('a-b-c-d');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('---Test---', 'City---')).toBe('test-city');
  });

  it('handles missing city', () => {
    expect(generateSlug("Bob's Plumbing", null)).toBe('bobs-plumbing');
  });

  it('appends suffix for collision avoidance', () => {
    expect(generateSlug("Sal's Pizza", 'Arlington', 'abc123def')).toBe('sals-pizza-arlington-abc123');
  });
});
