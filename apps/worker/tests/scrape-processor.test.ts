import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ScrapeJobData } from '@buildkit/shared';

// Mock the google-places module
vi.mock('../src/lib/google-places.js', () => ({
  searchPlaces: vi.fn(),
  parsePlace: vi.fn(),
}));

// Mock the email-extractor module
vi.mock('../src/lib/email-extractor.js', () => ({
  extractEmailsFromUrl: vi.fn(),
}));

// Mock @buildkit/shared db
vi.mock('@buildkit/shared', async () => {
  const actual = await vi.importActual('@buildkit/shared');
  return {
    ...actual,
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'new-company-id' }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
  };
});

import { searchPlaces, parsePlace } from '../src/lib/google-places.js';
import { extractEmailsFromUrl } from '../src/lib/email-extractor.js';
import { processScrapeJob } from '../src/processors/scrape.js';

describe('Scrape Processor', () => {
  const mockJob = {
    id: 'test-job-1',
    data: {
      jobId: 'db-job-id-1',
      zipCodes: ['75201'],
      searchQuery: 'plumbers',
      startedBy: 'user-1',
    },
    updateProgress: vi.fn(),
  } as unknown as Job<ScrapeJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls searchPlaces for each zip code', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([]);

    await processScrapeJob(mockJob);

    expect(searchPlaces).toHaveBeenCalledWith('plumbers', '75201', expect.any(String));
  });

  it('parses places and checks for duplicates', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([
      { id: 'place-1', displayName: { text: 'Test Plumbing' }, formattedAddress: '123 Main St' } as any,
    ]);
    vi.mocked(parsePlace).mockReturnValue({
      name: 'Test Plumbing',
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      phone: '555-1234',
      website: 'https://testplumbing.com',
      googlePlaceId: 'place-1',
      googleRating: 4.5,
      industry: 'Plumbing',
    });
    vi.mocked(extractEmailsFromUrl).mockResolvedValue(['info@testplumbing.com']);

    await processScrapeJob(mockJob);

    expect(parsePlace).toHaveBeenCalled();
    expect(extractEmailsFromUrl).toHaveBeenCalledWith('https://testplumbing.com', 8000);
  });

  it('reports progress via job.updateProgress', async () => {
    vi.mocked(searchPlaces).mockResolvedValue([]);

    await processScrapeJob(mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalled();
  });
});
